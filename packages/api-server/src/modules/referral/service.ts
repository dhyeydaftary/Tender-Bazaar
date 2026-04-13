import redis from '../../config/redis';
import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/error-handler';

interface ReferralStats {
  code: string;
  totalReferrals: number;
  successfulConversions: number;
  rewardsEarned: number;
  referralLink: string;
}

export const referralService = {
  async generateReferralCode(userId: string): Promise<string> {
    // Check if user already has a code
    const existingCode = await redis.get(`referral-code:${userId}`);
    if (existingCode) return existingCode;

    // Generate code: TB-{first4ofName}-{random4digits}
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    const namePrefix = user.name
      .replace(/[^a-zA-Z]/g, '')
      .substring(0, 4)
      .toUpperCase()
      .padEnd(4, 'X');
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const code = `TB-${namePrefix}-${randomDigits}`;

    // Store bidirectional mapping
    await redis.set(`referral-code:${userId}`, code);
    await redis.set(`referral-user:${code}`, userId);

    // Initialize stats
    await redis.hset(`referral-stats:${userId}`, {
      totalReferrals: '0',
      successfulConversions: '0',
      rewardsEarned: '0',
      pendingRewards: '0',
    });

    return code;
  },

  async getReferralStats(userId: string): Promise<ReferralStats> {
    let code = await redis.get(`referral-code:${userId}`);
    if (!code) {
      code = await this.generateReferralCode(userId);
    }

    const stats = await redis.hgetall(`referral-stats:${userId}`);

    return {
      code,
      totalReferrals: parseInt(stats.totalReferrals || '0', 10),
      successfulConversions: parseInt(stats.successfulConversions || '0', 10),
      rewardsEarned: parseInt(stats.rewardsEarned || '0', 10),
      referralLink: `https://tenderbazaar.com/register?ref=${code}`,
    };
  },

  async processReferral(
    referralCode: string,
    newUserId: string
  ): Promise<{ message: string }> {
    // Validate code exists
    const referrerId = await redis.get(`referral-user:${referralCode}`);
    if (!referrerId) {
      throw new AppError('Invalid referral code', 400, 'INVALID_REFERRAL_CODE');
    }

    // Cannot self-refer
    if (referrerId === newUserId) {
      throw new AppError('Cannot use your own referral code', 400, 'SELF_REFERRAL');
    }

    // Check if new user has already been referred
    const alreadyReferred = await redis.get(`referred-user:${newUserId}`);
    if (alreadyReferred) {
      throw new AppError('User has already been referred', 400, 'ALREADY_REFERRED');
    }

    // Mark new user as referred
    await redis.set(`referred-user:${newUserId}`, referrerId);

    // Increment referrer stats
    await redis.hincrby(`referral-stats:${referrerId}`, 'totalReferrals', 1);
    await redis.hincrby(`referral-stats:${referrerId}`, 'pendingRewards', 1);

    // Track referral history
    const newUser = await prisma.user.findUnique({
      where: { id: newUserId },
      select: { email: true },
    });

    const historyEntry = JSON.stringify({
      newUserId,
      email: newUser?.email ? maskEmail(newUser.email) : 'unknown',
      date: new Date().toISOString(),
      status: 'PENDING',
      reward: 0,
    });

    await redis.lpush(`referral-history:${referrerId}`, historyEntry);

    return { message: 'Referral applied successfully' };
  },

  async claimReward(userId: string): Promise<{ message: string; reward: number }> {
    const stats = await redis.hgetall(`referral-stats:${userId}`);
    const pendingRewards = parseInt(stats.pendingRewards || '0', 10);

    if (pendingRewards <= 0) {
      throw new AppError('No rewards to claim', 400, 'NO_REWARDS');
    }

    // Each referral = 1 month Starter plan value (INR 1499)
    const rewardAmount = pendingRewards * 1499;

    // Update stats
    await redis.hincrby(`referral-stats:${userId}`, 'successfulConversions', pendingRewards);
    await redis.hincrby(`referral-stats:${userId}`, 'rewardsEarned', rewardAmount);
    await redis.hset(`referral-stats:${userId}`, 'pendingRewards', '0');

    return {
      message: `Reward of INR ${rewardAmount.toLocaleString('en-IN')} claimed successfully`,
      reward: rewardAmount,
    };
  },

  async getReferralHistory(userId: string): Promise<Array<{
    newUserId: string;
    email: string;
    date: string;
    status: string;
    reward: number;
  }>> {
    const history = await redis.lrange(`referral-history:${userId}`, 0, -1);
    return history.map((item) => JSON.parse(item));
  },
};

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***';
  const maskedLocal = local.substring(0, 2) + '***' + (local.length > 2 ? local.substring(local.length - 1) : '');
  return `${maskedLocal}@${domain}`;
}
