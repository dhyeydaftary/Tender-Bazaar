import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';
import { prisma } from '../../config/database';
import redis from '../../config/redis';
import { env, DEVELOPMENT_SHORTCUTS_ENABLED } from '../../config/env';
import { AppError } from '../../shared/middleware/error-handler';
import { JWT_ALGORITHM } from '../../shared/middleware/auth';
import { publishNotificationJob } from '../../queue/notification-publisher';
import { verifyGoogleIdToken } from './google-verifier';

const SALT_ROUNDS = 12;
const OTP_TTL = 300; // 5 minutes
/** Wrong codes allowed per issued OTP before the phone is locked out. */
export const OTP_MAX_ATTEMPTS = 5;
/** Lockout after too many wrong codes, in seconds. */
export const OTP_LOCKOUT_SECONDS = 15 * 60;
/** Minimum gap between two codes to the same phone, in seconds. */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
/** Codes that may be issued to one phone per rolling hour. */
export const OTP_MAX_SENDS_PER_HOUR = 5;
const RESET_TOKEN_TTL = 3600; // 1 hour
const TOKEN_BLACKLIST_PREFIX = 'blacklist:';
const OTP_PREFIX = 'otp:';
const RESET_PREFIX = 'reset:';

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Every token carries a random `jti`. Without it two tokens minted for the
 * same user within the same second were byte-identical (same claims, same
 * `iat`/`exp`): refresh rotation then "rotated" to the very same string, so
 * the old refresh token stayed valid, and two sign-ins in one second collided
 * on the unique Session.refreshToken column.
 */
function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, env.JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: env.JWT_EXPIRY as any,
  });
}

function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, env.JWT_REFRESH_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: env.JWT_REFRESH_EXPIRY as any,
  });
}

/**
 * The single response for every failed email/password login: unknown email,
 * an account without a password (Google / OTP only) and a wrong password are
 * indistinguishable, so the endpoint cannot be used to discover accounts.
 */
export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

function invalidCredentials(): AppError {
  return new AppError(INVALID_CREDENTIALS_MESSAGE, 401, 'INVALID_CREDENTIALS');
}

/**
 * A bcrypt hash of a random value, compared against when there is no real
 * hash to check, so an unknown email takes as long to reject as a wrong
 * password. Computed once, on first use.
 */
let timingDummyHash: Promise<string> | null = null;
function getTimingDummyHash(): Promise<string> {
  timingDummyHash ??= bcrypt.hash(crypto.randomBytes(16).toString('hex'), SALT_ROUNDS);
  return timingDummyHash;
}

/**
 * A six-digit code from the operating system's CSPRNG. Math.random is a
 * predictable PRNG: with a few observed codes its state can be recovered and
 * the next codes predicted, so it must never mint a credential.
 */
function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/** Codes are stored hashed, so a Redis read never yields a usable code. */
function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function otpMatches(storedHash: string, presented: string): boolean {
  const a = Buffer.from(storedHash, 'utf8');
  const b = Buffer.from(hashOtp(presented), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const otpKeys = (phone: string) => ({
  code: `${OTP_PREFIX}${phone}`,
  attempts: `${OTP_PREFIX}attempts:${phone}`,
  lock: `${OTP_PREFIX}lock:${phone}`,
  cooldown: `${OTP_PREFIX}cooldown:${phone}`,
  sends: `${OTP_PREFIX}sends:${phone}`,
});

/**
 * Seconds until `key` expires, floored at 1 so a client never receives a
 * zero or negative wait for a restriction that is still in force. Used to
 * tell the frontend how long to show a countdown and keep a button disabled;
 * the server re-checks on every request, so the value is advisory.
 */
async function secondsUntilExpiry(key: string): Promise<number> {
  const ttl = await redis.ttl(key);
  return ttl > 0 ? ttl : 1;
}

function otpLocked(retryAfterSeconds: number): AppError {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return new AppError(
    `Too many incorrect codes. Please wait ${minutes} minute${minutes === 1 ? '' : 's'} before trying again.`,
    429,
    'OTP_LOCKED',
    { retryAfterSeconds },
  );
}

/** The one answer for a wrong, expired, reused or never-issued code. */
function invalidOtp(attemptsRemaining: number): AppError {
  return new AppError('Invalid or expired OTP', 401, 'INVALID_OTP', { attemptsRemaining });
}

export const authService = {
  async register(data: { name: string; email: string; password: string; phone?: string }) {
    // Check if registration is open
    const regSetting = await prisma.adminSetting.findUnique({
      where: { category_key: { category: 'general', key: 'registrationOpen' } },
    });
    if (regSetting && regSetting.value === false) {
      throw new AppError('User registration is temporarily disabled by administrator', 403, 'REGISTRATION_DISABLED');
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          ...(data.phone ? [{ phone: data.phone }] : []),
        ],
      },
    });

    if (existingUser) {
      // One response for both fields: the caller learns that registration
      // did not go through, not which identifier is already taken. Fully
      // hiding whether an account exists needs a verify-before-create flow
      // (see the Phase 2 report); until then the auth rate limiter bounds how
      // fast this can be probed.
      throw new AppError(
        'An account with this email or phone number already exists. Sign in or reset your password.',
        409,
        'ACCOUNT_EXISTS',
      );
    }

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        phone: data.phone,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    const tokenPayload: TokenPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { user, accessToken, refreshToken };
  },

  async login(data: { email: string; password: string }, meta?: { userAgent?: string; ipAddress?: string }) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        passwordHash: true,
        isEmailVerified: true,
        avatarUrl: true,
        createdAt: true,
        subscription: {
          select: {
            id: true,
            status: true,
            billingCycle: true,
            endDate: true,
            plan: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.passwordHash) {
      await bcrypt.compare(data.password, await getTimingDummyHash());
      throw invalidCredentials();
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw invalidCredentials();
    }

    // Enforce maintenance mode for non-admin users
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      const maintenanceSetting = await prisma.adminSetting.findUnique({
        where: { category_key: { category: 'general', key: 'maintenanceMode' } },
      });
      if (maintenanceSetting && maintenanceSetting.value === true) {
        throw new AppError('Platform is currently under maintenance. Please try again later.', 503, 'MAINTENANCE_MODE');
      }
    }

    const tokenPayload: TokenPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        userAgent: meta?.userAgent,
        ipAddress: meta?.ipAddress,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      try {
        await prisma.auditLog.create({
          data: {
            actorId: user.id,
            actorEmail: user.email,
            actorRole: user.role,
            action: 'auth.login',
            entity: 'AdminPanel',
            entityId: 'session',
            metadata: {
              ipAddress: meta?.ipAddress,
              userAgent: meta?.userAgent,
              details: `${user.name || user.email} logged into the Admin Panel`,
            },
          },
        });
      } catch (err) {
        console.error('[AuditLog] Failed to log admin login:', err);
      }
    }

    const { passwordHash: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, accessToken, refreshToken };
  },

  async sendOtp(phone: string) {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const keys = otpKeys(cleanPhone);

    // Throttles. These answer the same way whether or not the number belongs
    // to an account, so they reveal nothing about registration.
    if (await redis.get(keys.lock)) throw otpLocked(await secondsUntilExpiry(keys.lock));
    if (await redis.get(keys.cooldown)) {
      const retryAfterSeconds = await secondsUntilExpiry(keys.cooldown);
      throw new AppError(
        `A code was sent recently. Please wait ${retryAfterSeconds} second${retryAfterSeconds === 1 ? '' : 's'} before requesting another.`,
        429,
        'OTP_COOLDOWN',
        { retryAfterSeconds },
      );
    }
    const sends = await redis.incr(keys.sends);
    if (sends === 1) await redis.expire(keys.sends, 3600);
    if (sends > OTP_MAX_SENDS_PER_HOUR) {
      const retryAfterSeconds = await secondsUntilExpiry(keys.sends);
      const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
      throw new AppError(
        `Too many codes requested for this number. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
        429,
        'OTP_TOO_MANY_REQUESTS',
        { retryAfterSeconds },
      );
    }

    // Issuing a code replaces any earlier one (same key) and resets the
    // wrong-attempt counter for the new code.
    const otp = generateOtp();
    await redis.setex(keys.code, OTP_TTL, hashOtp(otp));
    await redis.del(keys.attempts);
    await redis.setex(keys.cooldown, OTP_RESEND_COOLDOWN_SECONDS, '1');

    const msg91AuthKey = process.env.MSG91_AUTH_KEY;
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
    const fast2smsKey = process.env.FAST2SMS_API_KEY;

    let sent = false;

    // 1. Try Twilio if configured
    if (twilioSid && twilioToken && twilioFrom && twilioSid !== 'your-twilio-sid') {
      try {
        const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
        const params = new URLSearchParams();
        params.append('To', `+91${cleanPhone}`);
        params.append('From', twilioFrom);
        params.append('Body', `Your TenderBazaar verification code is ${otp}. Valid for 10 minutes.`);

        await axios.post(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          params.toString(),
          {
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );
        console.log(`[SMS] OTP dispatched via Twilio to +91${cleanPhone}`);
        sent = true;
      } catch (twErr: any) {
        console.error('[SMS] Failed to send OTP via Twilio:', twErr?.response?.data || twErr.message);
      }
    }

    // 2. Try MSG91 if configured
    if (!sent && msg91AuthKey && msg91AuthKey !== 'your-msg91-auth-key') {
      try {
        await axios.post(
          'https://control.msg91.com/api/v5/otp',
          {
            mobile: `91${cleanPhone}`,
            otp,
            sender: process.env.MSG91_SENDER_ID || 'TNDBZR',
            template_id: process.env.MSG91_TEMPLATE_ID,
            message: `Your TenderBazaar verification code is ${otp}. Valid for 10 minutes.`,
          },
          {
            headers: {
              authkey: msg91AuthKey,
              'Content-Type': 'application/json',
            },
          }
        );
        console.log(`[SMS] OTP dispatched via MSG91 to 91${cleanPhone}`);
        sent = true;
      } catch (smsErr: any) {
        console.error('[SMS] Failed to send OTP via MSG91:', smsErr?.response?.data || smsErr.message);
      }
    }

    // 3. Try Fast2SMS if configured
    if (!sent && fast2smsKey && fast2smsKey !== 'your-fast2sms-api-key') {
      try {
        await axios.post(
          'https://www.fast2sms.com/dev/bulkV2',
          {
            variables_values: otp,
            route: 'otp',
            numbers: cleanPhone,
          },
          {
            headers: {
              authorization: fast2smsKey,
            },
          }
        );
        console.log(`[SMS] OTP dispatched via Fast2SMS to ${cleanPhone}`);
        sent = true;
      } catch (f2sErr: any) {
        console.error('[SMS] Failed to send OTP via Fast2SMS:', f2sErr?.response?.data || f2sErr.message);
      }
    }

    if (!sent) {
      if (DEVELOPMENT_SHORTCUTS_ENABLED) {
        // Local development without an SMS provider: the code has to come from
        // somewhere, so it goes to the developer's own console.
        console.log(`[SMS] No SMS provider configured. Development OTP for ${cleanPhone}: ${otp}`);
      } else {
        // A deployed server must never report "sent" for a code that went
        // nowhere, and never writes the code to its logs. The code is
        // withdrawn so it cannot be used, and the caller gets an explicit
        // delivery error.
        await redis.del(keys.code);
        // Same notion of "configured" as the send attempts above: the
        // .env.example placeholders do not count.
        const configuredProvider = Boolean(
          (twilioSid && twilioToken && twilioFrom && twilioSid !== 'your-twilio-sid') ||
            (msg91AuthKey && msg91AuthKey !== 'your-msg91-auth-key') ||
            (fast2smsKey && fast2smsKey !== 'your-fast2sms-api-key'),
        );
        console.error(
          configuredProvider
            ? `[SMS] Every configured SMS provider failed; the OTP for ${cleanPhone} was NOT delivered.`
            : `[SMS] No SMS provider is configured; the OTP for ${cleanPhone} was NOT delivered.`,
        );
        throw new AppError(
          configuredProvider
            ? 'We could not send the verification code right now. Please try again later.'
            : 'Phone verification is not available on this server.',
          configuredProvider ? 502 : 503,
          configuredProvider ? 'OTP_DELIVERY_FAILED' : 'SMS_NOT_CONFIGURED',
        );
      }
    }

    // Timing the client needs for its countdowns. No code material is here;
    // the server re-applies every limit on each request regardless.
    return {
      message: 'OTP sent successfully',
      expiresInSeconds: OTP_TTL,
      resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
      maxAttempts: OTP_MAX_ATTEMPTS,
      sendsRemainingThisHour: Math.max(0, OTP_MAX_SENDS_PER_HOUR - sends),
    };
  },

  async verifyOtp(phone: string, otp: string) {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const keys = otpKeys(cleanPhone);

    if (await redis.get(keys.lock)) throw otpLocked(await secondsUntilExpiry(keys.lock));

    const storedHash = await redis.get(keys.code);
    if (!storedHash || !otpMatches(storedHash, otp)) {
      // Count the failure whether a code exists or not, so guessing against a
      // number with no outstanding code is throttled exactly like guessing
      // against one that has.
      const attempts = await redis.incr(keys.attempts);
      if (attempts === 1) await redis.expire(keys.attempts, OTP_LOCKOUT_SECONDS);
      if (attempts >= OTP_MAX_ATTEMPTS) {
        await redis.setex(keys.lock, OTP_LOCKOUT_SECONDS, '1');
        await redis.del(keys.code);
        await redis.del(keys.attempts);
        throw otpLocked(OTP_LOCKOUT_SECONDS);
      }
      throw invalidOtp(OTP_MAX_ATTEMPTS - attempts);
    }

    // One use only: the code is gone before the sign-in is processed.
    await redis.del(keys.code);
    await redis.del(keys.attempts);

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: cleanPhone },
          { phone: `+91${cleanPhone}` },
          { phone },
        ],
      },
    });

    if (!user) {
      const email = `${cleanPhone}@phone.tenderbazaar.com`;
      const existingByEmail = await prisma.user.findUnique({ where: { email } });
      if (existingByEmail) {
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: { phone: cleanPhone, isPhoneVerified: true },
        });
      } else {
        user = await prisma.user.create({
          data: {
            name: 'User',
            email,
            phone: cleanPhone,
            isPhoneVerified: true,
          },
        });
      }
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { isPhoneVerified: true },
      });
    }

    const tokenPayload: TokenPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const userWithSub = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatarUrl: true,
        isPhoneVerified: true,
        subscription: {
          select: {
            id: true,
            status: true,
            billingCycle: true,
            endDate: true,
            plan: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    return {
      user: userWithSub || { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
      accessToken,
      refreshToken,
    };
  },

  async googleAuth(idToken: string) {
    // Every token is verified with Google (signature, issuer, audience,
    // expiry, verified email) before anything is looked up. There is no
    // unverified path in any environment.
    const payload = await verifyGoogleIdToken(idToken);

    // A Google account already linked to a user signs in as that user.
    let user = await prisma.user.findUnique({ where: { googleId: payload.sub } });

    if (!user) {
      // Otherwise the verified email decides. Emails are not normalised on
      // registration, so match case-insensitively and refuse an ambiguous match
      // rather than guess which account is meant.
      const byEmail = await prisma.user.findMany({
        where: { email: { equals: payload.email, mode: 'insensitive' } },
        take: 2,
      });
      if (byEmail.length > 1) {
        throw new AppError(
          'This Google account cannot be linked automatically. Sign in with your password instead.',
          409,
          'GOOGLE_LINK_AMBIGUOUS',
        );
      }
      const existing = byEmail[0];

      if (!existing) {
        user = await prisma.user.create({
          data: {
            name: payload.name,
            email: payload.email,
            googleId: payload.sub,
            avatarUrl: payload.picture,
            isEmailVerified: true,
          },
        });
      } else if (existing.googleId) {
        // The email belongs to an account linked to a DIFFERENT Google account.
        throw new AppError(
          'This email is linked to a different Google account.',
          409,
          'GOOGLE_ACCOUNT_MISMATCH',
        );
      } else if (existing.role === 'ADMIN' || existing.role === 'SUPER_ADMIN') {
        // Administrator accounts are never linked implicitly: a Google sign-in
        // must not become a new way into an admin account. Admins sign in with
        // their password.
        throw new AppError(
          'Administrator accounts must sign in with their password.',
          403,
          'GOOGLE_LINK_FORBIDDEN',
        );
      } else {
        user = await prisma.user.update({
          where: { id: existing.id },
          data: { googleId: payload.sub, isEmailVerified: true },
        });
      }
    }

    const tokenPayload: TokenPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const userWithSub = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        subscription: {
          select: {
            id: true,
            status: true,
            billingCycle: true,
            endDate: true,
            plan: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    return {
      user: userWithSub || { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl },
      accessToken,
      refreshToken,
    };
  },

  async refreshToken(token: string) {
    let decoded: TokenPayload;
    try {
      decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: [JWT_ALGORITHM] }) as TokenPayload;
    } catch {
      throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    const session = await prisma.session.findUnique({
      where: { refreshToken: token },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new AppError('Session expired or not found', 401, 'SESSION_EXPIRED');
    }

    // Rotate refresh token
    const newTokenPayload: TokenPayload = { userId: decoded.userId, email: decoded.email, role: decoded.role };
    const newAccessToken = generateAccessToken(newTokenPayload);
    const newRefreshToken = generateRefreshToken(newTokenPayload);

    // Invalidate old session, create new one
    await prisma.session.delete({ where: { id: session.id } });
    await prisma.session.create({
      data: {
        userId: decoded.userId,
        refreshToken: newRefreshToken,
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  },

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Don't reveal whether email exists
      return { message: 'If the email exists, a reset link has been sent' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    await redis.setex(`${RESET_PREFIX}${hashedToken}`, RESET_TOKEN_TTL, user.id);

    // Publish password reset email job to notification queue
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    if (DEVELOPMENT_SHORTCUTS_ENABLED) {
      // The link carries the reset token, a one-hour credential for the
      // account. Only a developer's own console may see it; on a deployed
      // server it goes to the user by email and nowhere else.
      console.log(`[Email] Password reset link for ${email}: ${resetUrl}`);
    }

    await publishNotificationJob({
      userId: user.id,
      type: 'SYSTEM',
      channel: 'EMAIL',
      title: 'Reset Your TenderBazaar Password',
      message: `We received a request to reset your password. Click the link to set a new password: ${resetUrl}. This link is valid for 1 hour. If you did not request this, you can safely ignore this email.`,
      recipientEmail: email,
      data: { resetUrl },
    });

    return { message: 'If the email exists, a reset link has been sent' };
  },

  async resetPassword(token: string, newPassword: string) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const userId = await redis.get(`${RESET_PREFIX}${hashedToken}`);

    if (!userId) {
      throw new AppError('Invalid or expired reset token', 400, 'INVALID_RESET_TOKEN');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await redis.del(`${RESET_PREFIX}${hashedToken}`);

    // Invalidate all existing sessions for this user
    await prisma.session.deleteMany({ where: { userId } });

    return { message: 'Password reset successfully' };
  },

  async changePassword(userId: string, data: { currentPassword: string; newPassword: string }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      throw new AppError('User not found or password not configured', 404, 'USER_NOT_FOUND');
    }

    const isMatch = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
    }

    const passwordHash = await bcrypt.hash(data.newPassword, SALT_ROUNDS);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Password updated successfully' };
  },

  async logout(refreshToken: string, accessToken?: string) {
    // Delete session
    const session = await prisma.session.findUnique({
      where: { refreshToken },
    });

    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }

    // Blacklist access token if provided (TTL = remaining token expiry)
    if (accessToken) {
      try {
        const decoded = jwt.decode(accessToken) as any;
        if (decoded?.exp) {
          const ttl = decoded.exp - Math.floor(Date.now() / 1000);
          if (ttl > 0) {
            await redis.setex(`${TOKEN_BLACKLIST_PREFIX}${accessToken}`, ttl, '1');
          }
        }
      } catch {
        // Ignore decode errors during logout
      }
    }

    return { message: 'Logged out successfully' };
  },

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const result = await redis.get(`${TOKEN_BLACKLIST_PREFIX}${token}`);
    return result !== null;
  },
};
