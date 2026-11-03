import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

async function runLiveTick() {
  try {
    // 1. Get random active bidder users (excluding real users)
    const users = await prisma.user.findMany({
      where: {
        role: 'USER',
        email: { notIn: ['nakshatrah2410@gmail.com', 'demouser@gmail.com'] },
      },
      take: 50,
      select: { id: true },
    });
    if (users.length === 0) return;

    // 2. Get top tenders
    const tenders = await prisma.tender.findMany({
      take: 25,
      orderBy: { viewCount: 'desc' },
      select: { id: true, title: true, viewCount: true },
    });

    if (tenders.length > 0) {
      const randomTender = tenders[Math.floor(Math.random() * tenders.length)];
      const randomUser = users[Math.floor(Math.random() * users.length)];

      // Increment view count for live traffic simulation
      const updated = await prisma.tender.update({
        where: { id: randomTender.id },
        data: { viewCount: { increment: Math.random() < 0.5 ? 1 : 2 } },
        select: { id: true, title: true, viewCount: true },
      });
      console.log(`[LIVE ACTIVITY] View incremented: "${updated.title.slice(0, 30)}..." -> now ${updated.viewCount} views`);
    }

    // 3. Organic broadcast reads
    if (Math.random() < 0.35) {
      const updated: any = await prisma.$queryRawUnsafe(`
        UPDATE broadcast_campaigns
        SET opened = LEAST(delivered, opened + 1)
        WHERE id IN (SELECT id FROM broadcast_campaigns WHERE opened < delivered ORDER BY sent_at DESC LIMIT 1)
        RETURNING title, opened, delivered
      `).catch(() => []);
      if (updated && updated[0]) {
        console.log(`[LIVE ACTIVITY] User read broadcast: "${updated[0].title.slice(0, 30)}..." -> ${updated[0].opened}/${updated[0].delivered} opened`);
      }
    }

    // 4. Organic blog post views & likes (Content Management)
    const publishedPosts = await prisma.blogPost.findMany({
      where: { status: 'PUBLISHED' },
      select: { id: true, title: true },
    });

    if (publishedPosts.length > 0) {
      // 55% chance: blog post view increment
      if (Math.random() < 0.55) {
        const post = publishedPosts[Math.floor(Math.random() * publishedPosts.length)];
        const inc = Math.random() < 0.3 ? 2 : 1;
        const newViews = await redis.incrby(`blog:views:${post.id}`, inc);
        console.log(`[LIVE CONTENT] Reader viewed blog (+${inc}): "${post.title.slice(0, 25)}..." -> ${newViews} views`);
      }

      // 20% chance: blog post like
      if (Math.random() < 0.2) {
        const post = publishedPosts[Math.floor(Math.random() * publishedPosts.length)];
        const newLikes = await redis.incr(`blog:likes:${post.id}`);
        console.log(`[LIVE CONTENT] Reader liked blog (+1): "${post.title.slice(0, 25)}..." -> ${newLikes} likes`);
      }
    }

    // 5. Organic banner impressions & clicks
    const activeBanners = await prisma.banner.findMany({
      where: { status: 'PUBLISHED' },
      select: { id: true, title: true },
    });

    if (activeBanners.length > 0) {
      // 40% chance: banner impressions increment
      if (Math.random() < 0.4) {
        const banner = activeBanners[Math.floor(Math.random() * activeBanners.length)];
        const inc = Math.floor(Math.random() * 3) + 1;
        const newImp = await redis.incrby(`banner:impressions:${banner.id}`, inc);
        console.log(`[LIVE CONTENT] Banner impression (+${inc}): "${banner.title.slice(0, 25)}..." -> ${newImp} imp`);
      }

      // 12% chance: banner click
      if (Math.random() < 0.12) {
        const banner = activeBanners[Math.floor(Math.random() * activeBanners.length)];
        const newClk = await redis.incr(`banner:clicks:${banner.id}`);
        console.log(`[LIVE CONTENT] Banner clicked (+1): "${banner.title.slice(0, 25)}..." -> ${newClk} clicks`);
      }
    }

    // 6. Realistic new tender award result (35% chance every tick)
    if (Math.random() < 0.35) {
      const tenderToAward = await prisma.tender.findFirst({
        where: {
          status: { not: 'AWARDED' },
          results: { none: {} },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (tenderToAward) {
        const companies = [
          { company: 'Larsen & Toubro Limited', rep: 'Rajesh Sharma' },
          { company: 'Tata Projects Limited', rep: 'Vikram Malhotra' },
          { company: 'Dilip Buildcon Limited', rep: 'Devendra Jain' },
          { company: 'NCC Limited', rep: 'Alluri Ranga Raju' },
          { company: 'Bharat Electronics Limited', rep: 'Sunil Verma' },
          { company: 'Infosys Public Services', rep: 'Anand Kulkarni' },
          { company: 'Voltas Limited', rep: 'Pradeep Bakshi' },
          { company: 'Blue Star Limited', rep: 'B. Thiagarajan' },
        ];
        const winner = companies[Math.floor(Math.random() * companies.length)];
        const baseValue = tenderToAward.estimatedValue && tenderToAward.estimatedValue > 100000
          ? tenderToAward.estimatedValue
          : 5000000 + Math.floor(Math.random() * 50000000);
        const awardedValue = Math.round(baseValue * (0.91 + Math.random() * 0.08));

        await prisma.tenderResult.create({
          data: {
            tenderId: tenderToAward.id,
            winnerName: winner.rep,
            winnerCompany: winner.company,
            awardedValue,
            awardedDate: new Date(),
          },
        });

        await prisma.tender.update({
          where: { id: tenderToAward.id },
          data: { status: 'AWARDED' },
        });

        console.log(`[LIVE RESULTS] New Tender Result Awarded: "${tenderToAward.title.slice(0, 30)}..." -> Won by ${winner.company}`);
      }
    }
  } catch (err: any) {
    console.error('[LIVE ACTIVITY ERROR]', err.message);
  }
}

async function loop() {
  console.log('--- Starting Live Activity Engine ---');
  console.log('Simulating realistic live bidder activity across Tenders, Notifications, and Content every 6-8s...');

  while (true) {
    await runLiveTick();
    const delay = 6000 + Math.floor(Math.random() * 3000); // 6 to 9 seconds
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

loop().catch(console.error);
