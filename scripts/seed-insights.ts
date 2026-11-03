import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

async function main() {
  console.log('Seeding initial insights data...');

  const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const normalUser = await prisma.user.findFirst({ where: { role: 'USER' } });

  const superAdminId = superAdmin?.id || 'admin-1';
  const superAdminEmail = superAdmin?.email || 'superadmin@tenderbazaar.com';
  const adminId = admin?.id || 'admin-2';
  const adminEmail = admin?.email || 'admin@tenderbazaar.com';
  const userId = normalUser?.id || superAdminId;

  // 1. Audit logs
  const existingAuditCount = await prisma.auditLog.count();
  if (existingAuditCount === 0) {
    const now = Date.now();
    const hours = (h: number) => new Date(now - h * 3600 * 1000);

    const initialLogs = [
      {
        actorId: superAdminId,
        actorEmail: superAdminEmail,
        actorRole: 'SUPER_ADMIN' as const,
        action: 'settings.update',
        entity: 'RateLimiter',
        entityId: 'global',
        changes: { maxRequests: { old: 100, new: 10000 } },
        metadata: { ipAddress: '103.21.58.193', details: 'Increased global dev rate limit to 10,000 req/15m' },
        createdAt: hours(1),
      },
      {
        actorId: superAdminId,
        actorEmail: superAdminEmail,
        actorRole: 'SUPER_ADMIN' as const,
        action: 'auth.login',
        entity: 'AdminPanel',
        entityId: 'session',
        changes: null,
        metadata: { ipAddress: '103.21.58.193', details: 'Admin logged in successfully via Web Console' },
        createdAt: hours(2),
      },
      {
        actorId: adminId,
        actorEmail: adminEmail,
        actorRole: 'ADMIN' as const,
        action: 'scraper.trigger',
        entity: 'ScraperHealth',
        entityId: 'GeM',
        changes: { status: { old: 'IDLE', new: 'RUNNING' } },
        metadata: { ipAddress: '49.36.142.87', details: 'Triggered GeM scraper run (101 tenders synchronized)' },
        createdAt: hours(4),
      },
      {
        actorId: adminId,
        actorEmail: adminEmail,
        actorRole: 'ADMIN' as const,
        action: 'tender.update',
        entity: 'Tender',
        entityId: 'cmuwcdm43001s10e1y97o91yc',
        changes: { status: { old: 'DRAFT', new: 'ACTIVE' } },
        metadata: { ipAddress: '49.36.142.87', details: 'Verified and activated Delhi-Meerut RRTS Corridor tender' },
        createdAt: hours(7),
      },
      {
        actorId: superAdminId,
        actorEmail: superAdminEmail,
        actorRole: 'SUPER_ADMIN' as const,
        action: 'report.export',
        entity: 'Report',
        entityId: 'tenders-q1',
        changes: null,
        metadata: { ipAddress: '103.21.58.193', details: 'Exported Quarterly Tender Analytics report (CSV format)' },
        createdAt: hours(12),
      },
      {
        actorId: adminId,
        actorEmail: adminEmail,
        actorRole: 'ADMIN' as const,
        action: 'scraper.trigger',
        entity: 'ScraperHealth',
        entityId: 'CPPP',
        changes: { status: { old: 'IDLE', new: 'RUNNING' } },
        metadata: { ipAddress: '49.36.142.87', details: 'Triggered CPPP national portal sync (39 tenders updated)' },
        createdAt: hours(18),
      },
      {
        actorId: superAdminId,
        actorEmail: superAdminEmail,
        actorRole: 'SUPER_ADMIN' as const,
        action: 'plan.update',
        entity: 'SubscriptionPlan',
        entityId: 'professional',
        changes: { monthlyPrice: { old: 3999, new: 4999 } },
        metadata: { ipAddress: '103.21.58.193', details: 'Updated Professional plan pricing and added unlimited comparison' },
        createdAt: hours(26),
      },
      {
        actorId: adminId,
        actorEmail: adminEmail,
        actorRole: 'ADMIN' as const,
        action: 'notification.broadcast',
        entity: 'Notification',
        entityId: 'broadcast-1',
        changes: null,
        metadata: { ipAddress: '49.36.142.87', details: 'Dispatched portal maintenance advisory to all active users' },
        createdAt: hours(34),
      },
      {
        actorId: superAdminId,
        actorEmail: superAdminEmail,
        actorRole: 'SUPER_ADMIN' as const,
        action: 'settings.update',
        entity: 'Elasticsearch',
        entityId: 'cluster',
        changes: { replicas: { old: 0, new: 1 } },
        metadata: { ipAddress: '103.21.58.193', details: 'Optimized tender full-text search index and ngram analyzer' },
        createdAt: hours(48),
      },
      {
        actorId: superAdminId,
        actorEmail: superAdminEmail,
        actorRole: 'SUPER_ADMIN' as const,
        action: 'auth.login',
        entity: 'AdminPanel',
        entityId: 'session',
        changes: null,
        metadata: { ipAddress: '103.21.58.193', details: 'Super Admin routine security login' },
        createdAt: hours(60),
      },
      {
        actorId: adminId,
        actorEmail: adminEmail,
        actorRole: 'ADMIN' as const,
        action: 'user.update',
        entity: 'User',
        entityId: normalUser?.id || 'user-1',
        changes: { isEmailVerified: { old: false, new: true } },
        metadata: { ipAddress: '49.36.142.87', details: `Verified email address for ${normalUser?.email || 'user'}` },
        createdAt: hours(72),
      },
      {
        actorId: adminId,
        actorEmail: adminEmail,
        actorRole: 'ADMIN' as const,
        action: 'scraper.trigger',
        entity: 'ScraperHealth',
        entityId: 'mahatenders',
        changes: { status: { old: 'IDLE', new: 'COMPLETED' } },
        metadata: { ipAddress: '49.36.142.87', details: 'Executed scheduled run for Maharashtra E-Tenders' },
        createdAt: hours(96),
      },
    ];

    for (const log of initialLogs) {
      await prisma.auditLog.create({ data: log });
    }
    console.log(`Created ${initialLogs.length} initial audit logs.`);
  }

  // 2. Search History
  const existingSearchCount = await prisma.searchHistory.count();
  if (existingSearchCount === 0) {
    const queries = [
      { q: 'construction tender', count: 48 },
      { q: 'solar energy', count: 36 },
      { q: 'medical equipment', count: 32 },
      { q: 'highway maintenance', count: 29 },
      { q: 'IT services cloud', count: 25 },
      { q: 'water supply pipeline', count: 22 },
      { q: 'cctv surveillance', count: 18 },
      { q: 'delhi rrts', count: 15 },
      { q: 'smart city', count: 14 },
      { q: 'railway electrification', count: 12 },
    ];

    const now = Date.now();
    for (const item of queries) {
      for (let i = 0; i < item.count; i++) {
        const daysAgo = Math.floor(Math.random() * 28);
        const hoursAgo = Math.floor(Math.random() * 24);
        const createdAt = new Date(now - (daysAgo * 24 + hoursAgo) * 3600 * 1000);

        await prisma.searchHistory.create({
          data: {
            userId,
            query: item.q,
            resultCount: Math.floor(Math.random() * 30 + 5),
            createdAt,
          },
        });
      }
      try {
        await redis.zincrby('search:keywords', item.count, item.q);
      } catch (e) {}
    }
    console.log('Seeded search history and Redis keywords.');
  }

  // 3. Increment some realistic tender views if low
  const tendersWithZeroViews = await prisma.tender.count({ where: { viewCount: 0 } });
  if (tendersWithZeroViews > 50) {
    const allTenders = await prisma.tender.findMany({ select: { id: true } });
    for (const t of allTenders) {
      const views = Math.floor(Math.random() * 120 + 5);
      await prisma.tender.update({
        where: { id: t.id },
        data: { viewCount: views },
      });
    }
    console.log(`Updated realistic view counts for ${allTenders.length} tenders.`);
  }

  console.log('Seeding insights complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  });
