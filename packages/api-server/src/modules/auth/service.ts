import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';
import { prisma } from '../../config/database';
import redis from '../../config/redis';
import { env } from '../../config/env';
import { AppError } from '../../shared/middleware/error-handler';
import { publishNotificationJob } from '../../queue/notification-publisher';

const SALT_ROUNDS = 12;
const OTP_TTL = 300; // 5 minutes
const RESET_TOKEN_TTL = 3600; // 1 hour
const TOKEN_BLACKLIST_PREFIX = 'blacklist:';
const OTP_PREFIX = 'otp:';
const RESET_PREFIX = 'reset:';

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRY as any });
}

function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRY as any });
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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
      if (existingUser.email === data.email) {
        throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
      }
      throw new AppError('Phone number already registered', 409, 'PHONE_EXISTS');
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
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
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
    const otp = generateOtp();
    await redis.setex(`${OTP_PREFIX}${cleanPhone}`, OTP_TTL, otp);

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
      console.log(`[SMS] SMS Gateway credentials pending in .env. Generated OTP for ${cleanPhone}: ${otp}`);
    }

    return { message: 'OTP sent successfully' };
  },

  async verifyOtp(phone: string, otp: string) {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const storedOtp = await redis.get(`${OTP_PREFIX}${cleanPhone}`);

    if (!storedOtp || storedOtp !== otp) {
      throw new AppError('Invalid or expired OTP', 401, 'INVALID_OTP');
    }

    await redis.del(`${OTP_PREFIX}${cleanPhone}`);

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
    // SECURITY GATE
    //
    // The decode path below does NOT verify the token's signature, so anyone
    // who can reach this endpoint could otherwise present a self-made token
    // claiming any email address — including an existing admin's — and receive
    // a real session with that account's role.
    //
    // It is therefore refused unless BOTH hold:
    //   * the operator explicitly opted in (ALLOW_DEMO_GOOGLE_AUTH=true), and
    //   * this is a development server (NODE_ENV=development).
    //
    // The second condition means a production deployment cannot enable the
    // unsafe path by configuration alone. Replace this whole branch with a real
    // OAuth2Client.verifyIdToken() check before offering Google sign-in to
    // users; google-auth-library is already a dependency.
    const demoGoogleAuthEnabled =
      env.ALLOW_DEMO_GOOGLE_AUTH === 'true' && env.NODE_ENV === 'development';

    if (!demoGoogleAuthEnabled) {
      throw new AppError(
        'Google sign-in is not available on this server',
        503,
        'GOOGLE_AUTH_DISABLED',
      );
    }

    // For development, decode the token without Google verification
    // In production, use google-auth-library to verify:
    // const { OAuth2Client } = require('google-auth-library');
    // const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
    // const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
    // const payload = ticket.getPayload();

    let payload: { sub: string; email: string; name: string; picture?: string };
    try {
      // Attempt to decode JWT (in dev mode, we might receive a mock token)
      const decoded = jwt.decode(idToken) as any;
      if (!decoded || !decoded.email) {
        throw new Error('Invalid token payload');
      }
      payload = {
        sub: decoded.sub || decoded.id,
        email: decoded.email,
        name: decoded.name || 'Google User',
        picture: decoded.picture,
      };
    } catch {
      throw new AppError('Invalid Google token', 401, 'INVALID_GOOGLE_TOKEN');
    }

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId: payload.sub }, { email: payload.email }],
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: payload.name,
          email: payload.email,
          googleId: payload.sub,
          avatarUrl: payload.picture,
          isEmailVerified: true,
        },
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: payload.sub, isEmailVerified: true },
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
      decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
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
    console.log(`[Email] Password reset link for ${email}: ${resetUrl}`);

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
