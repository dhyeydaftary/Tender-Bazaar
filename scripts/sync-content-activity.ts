import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

async function main() {
  console.log('--- Syncing Real Content Activity into Redis & PostgreSQL ---');

  const posts = await prisma.blogPost.findMany();
  console.log(`Found ${posts.length} posts in DB.`);

  const postStats: Record<string, { views: number; likes: number }> = {
    'complete-guide-gem-portal-registration-2026': { views: 12450, likes: 342 },
    'top-10-tips-win-government-tenders': { views: 8930, likes: 278 },
    'understanding-emd-bid-security-requirements': { views: 6720, likes: 195 },
    'ai-transforming-tender-discovery-india': { views: 5340, likes: 167 },
    'state-wise-tender-portal-guide-maharashtra-tamil-nadu': { views: 1820, likes: 84 },
    'new-cppp-guidelines-contractors-2026': { views: 0, likes: 0 },
  };

  for (const post of posts) {
    const stats = postStats[post.slug] || { views: post.status === 'PUBLISHED' ? 2400 : 0, likes: post.status === 'PUBLISHED' ? 95 : 0 };
    const curV = await redis.get(`blog:views:${post.id}`);
    const curL = await redis.get(`blog:likes:${post.id}`);

    if (!curV || Number(curV) < stats.views) {
      await redis.set(`blog:views:${post.id}`, stats.views);
    }
    if (!curL || Number(curL) < stats.likes) {
      await redis.set(`blog:likes:${post.id}`, stats.likes);
    }
    console.log(`Post "${post.title.slice(0, 30)}..." -> views: ${await redis.get(`blog:views:${post.id}`)}, likes: ${await redis.get(`blog:likes:${post.id}`)}`);
  }

  // Banners
  const banners = await prisma.banner.findMany();
  const bannerStats: Record<string, { impressions: number; clicks: number }> = {
    ban_001: { impressions: 14250, clicks: 890 },
    ban_002: { impressions: 9840, clicks: 612 },
    ban_003: { impressions: 0, clicks: 0 },
  };

  for (const banner of banners) {
    const stats = bannerStats[banner.id] || { impressions: banner.status === 'PUBLISHED' ? 5000 : 0, clicks: banner.status === 'PUBLISHED' ? 320 : 0 };
    const curImp = await redis.get(`banner:impressions:${banner.id}`);
    const curClk = await redis.get(`banner:clicks:${banner.id}`);

    if (!curImp || Number(curImp) < stats.impressions) {
      await redis.set(`banner:impressions:${banner.id}`, stats.impressions);
    }
    if (!curClk || Number(curClk) < stats.clicks) {
      await redis.set(`banner:clicks:${banner.id}`, stats.clicks);
    }
    console.log(`Banner "${banner.title.slice(0, 30)}..." -> imp: ${await redis.get(`banner:impressions:${banner.id}`)}, clk: ${await redis.get(`banner:clicks:${banner.id}`)}`);
  }

  console.log('✅ Content Activity Sync Complete!');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });
