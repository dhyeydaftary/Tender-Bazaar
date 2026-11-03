import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Seeding Realistic Content into PostgreSQL ---');

  // Find or use admin
  const admin = await prisma.user.findFirst({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
  });
  const authorId = admin ? admin.id : 'cmuwcdlwt000010e182kkiyb5';
  const authorName = admin ? admin.name : 'Super Admin';

  // 1. Seed Blog Posts
  const blogPosts = [
    {
      title: 'Complete Guide to GeM Portal Registration 2026',
      slug: 'complete-guide-gem-portal-registration-2026',
      excerpt: 'Step-by-step walkthrough for registering your business on the Government e-Marketplace portal, including document requirements and verification process.',
      content: 'The Government e-Marketplace (GeM) is the premier national portal for public procurement in India. This guide covers mandatory documentation, Aadhaar/PAN linking, GST validation, bank account verification, and seller assessment criteria required in 2026.',
      authorId,
      authorName: 'Priya Sharma',
      status: 'PUBLISHED' as const,
      tags: ['GeM', 'Registration', 'Compliance', 'MSME'],
      publishedAt: new Date(Date.now() - 4 * 24 * 3600 * 1000),
      views: 12450,
      likes: 342,
    },
    {
      title: 'Top 10 Tips to Win Government Tenders',
      slug: 'top-10-tips-win-government-tenders',
      excerpt: 'Expert strategies and insider tips to improve your success rate in government tender bidding, from document preparation to pricing strategy.',
      content: 'Winning government contracts requires compliance, precision, and strategic bid preparation. Learn how to optimize technical qualification scores, submit compliant EMDs, and utilize AI bid assistant tools.',
      authorId,
      authorName: 'Rajesh Kumar',
      status: 'PUBLISHED' as const,
      tags: ['Bidding', 'Strategy', 'Procurement', 'Tenders'],
      publishedAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      views: 8930,
      likes: 278,
    },
    {
      title: 'Understanding EMD and Bid Security Requirements',
      slug: 'understanding-emd-bid-security-requirements',
      excerpt: 'A comprehensive breakdown of Earnest Money Deposit requirements across different government portals and how to manage your bid security efficiently.',
      content: 'Earnest Money Deposit (EMD) guarantees bidder commitment. Understand MSME exemptions under Rule 170 of GFR 2017, Bank Guarantee validity periods, and electronic EMD refund mechanisms.',
      authorId,
      authorName: 'Anita Desai',
      status: 'PUBLISHED' as const,
      tags: ['EMD', 'Finance', 'Compliance', 'Banking'],
      publishedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000),
      views: 6720,
      likes: 195,
    },
    {
      title: 'How AI is Transforming Tender Discovery in India',
      slug: 'ai-transforming-tender-discovery-india',
      excerpt: 'Explore how artificial intelligence and machine learning are revolutionizing the way businesses find and evaluate government tender opportunities.',
      content: 'With thousands of tenders published daily across central, state, and PSU portals, automated NLP extraction, semantic search, and eligibility matching empower contractors to never miss a critical opportunity.',
      authorId,
      authorName: 'Vikram Patel',
      status: 'PUBLISHED' as const,
      tags: ['AI', 'Innovation', 'Analytics', 'Technology'],
      publishedAt: new Date(Date.now() - 14 * 24 * 3600 * 1000),
      views: 5340,
      likes: 167,
    },
    {
      title: 'State-wise Tender Portal Guide: Maharashtra to Tamil Nadu',
      slug: 'state-wise-tender-portal-guide-maharashtra-tamil-nadu',
      excerpt: 'Navigate the different state e-procurement portals across India with this detailed guide covering registration, search, and bidding processes.',
      content: 'Each state maintains specialized digital infrastructure: Mahatenders, TN Tenders, KPPP Karnataka, and Kerala eTenders. Here is the operational handbook for inter-state bidders.',
      authorId,
      authorName: 'Meera Iyer',
      status: 'PUBLISHED' as const,
      tags: ['State Portals', 'Infrastructure', 'e-Procurement'],
      publishedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      views: 1820,
      likes: 84,
    },
    {
      title: 'New CPPP Guidelines: What Contractors Need to Know',
      slug: 'new-cppp-guidelines-contractors-2026',
      excerpt: 'The Central Public Procurement Portal has released updated guidelines for 2026. Here is everything contractors and suppliers need to know about the changes.',
      content: 'Major reforms in two-packet bidding, digital signature certificate (DSC) specifications, and vendor performance ratings have taken effect on CPPP.',
      authorId,
      authorName: 'Arjun Nair',
      status: 'DRAFT' as const,
      tags: ['CPPP', 'Guidelines', 'Policy'],
      publishedAt: null,
      views: 0,
      likes: 0,
    },
  ];

  for (const post of blogPosts) {
    const { views, likes, ...postData } = post;
    const upserted = await prisma.blogPost.upsert({
      where: { slug: postData.slug },
      update: { ...postData },
      create: { ...postData },
    });
  }
  console.log(`Seeded ${blogPosts.length} blog posts in PostgreSQL.`);

  // 2. Seed Announcements
  const announcements = [
    {
      id: 'ann_001',
      type: 'warning',
      title: 'Scheduled Maintenance: October 15, 2-4 AM IST',
      message: 'We will be performing scheduled server maintenance. The platform may be unavailable during this window. All scraping jobs will resume automatically.',
      targetAudience: 'all',
      isPinned: true,
      status: 'PUBLISHED' as const,
      startDate: new Date(Date.now() - 24 * 3600 * 1000),
      endDate: new Date(Date.now() + 3 * 24 * 3600 * 1000),
      authorId,
    },
    {
      id: 'ann_002',
      type: 'success',
      title: 'New Feature: AI Bid Assistant Now Available',
      message: 'Our AI-powered Bid Assistant can now help you draft technical and financial proposals. Available for Professional and Enterprise plan users.',
      targetAudience: 'paid',
      isPinned: true,
      status: 'PUBLISHED' as const,
      startDate: new Date(Date.now() - 48 * 3600 * 1000),
      endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      authorId,
    },
    {
      id: 'ann_003',
      type: 'info',
      title: 'GeM Portal Integration Upgraded to v3.0',
      message: 'We have upgraded our GeM scraper to support the latest portal changes. Expect faster updates and improved document extraction capabilities.',
      targetAudience: 'all',
      isPinned: false,
      status: 'PUBLISHED' as const,
      startDate: new Date(Date.now() - 72 * 3600 * 1000),
      endDate: new Date(Date.now() + 14 * 24 * 3600 * 1000),
      authorId,
    },
    {
      id: 'ann_004',
      type: 'info',
      title: 'Referral Program: Earn 20% Commission',
      message: 'Invite your business partners to TenderBazaar and earn 20% recurring commission on their subscription payments for the first 12 months.',
      targetAudience: 'enterprise',
      isPinned: false,
      status: 'PUBLISHED' as const,
      startDate: new Date(Date.now() - 96 * 3600 * 1000),
      endDate: new Date(Date.now() + 60 * 24 * 3600 * 1000),
      authorId,
    },
    {
      id: 'ann_005',
      type: 'warning',
      title: 'Price Revision Effective Next Month',
      message: 'Starting next month, subscription prices will be revised. Current subscribers will be grandfathered at existing rates until their renewal date.',
      targetAudience: 'all',
      isPinned: false,
      status: 'DRAFT' as const,
      startDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      endDate: new Date(Date.now() + 21 * 24 * 3600 * 1000),
      authorId,
    },
  ];

  for (const ann of announcements) {
    await prisma.announcement.upsert({
      where: { id: ann.id },
      update: { ...ann },
      create: { ...ann },
    });
  }
  console.log(`Seeded ${announcements.length} announcements in PostgreSQL.`);

  // 3. Seed Banners
  const banners = [
    {
      id: 'ban_001',
      title: 'Upgrade to Professional - 30% Off Yearly Plans',
      description: 'Exclusive festive offer for expanding contractors. Get unlimited AI checks and tender exports.',
      linkUrl: '/pricing?promo=PRO30',
      position: 'top',
      priority: 10,
      status: 'PUBLISHED' as const,
      startDate: new Date(Date.now() - 24 * 3600 * 1000),
      endDate: new Date(Date.now() + 14 * 24 * 3600 * 1000),
      authorId,
    },
    {
      id: 'ban_002',
      title: 'AI Bid Assistant - Write Winning Proposals in Minutes',
      description: 'Generate customized technical qualification responses tailored to RFP specs.',
      linkUrl: '/bid-assistant',
      position: 'dashboard',
      priority: 8,
      status: 'PUBLISHED' as const,
      startDate: new Date(Date.now() - 48 * 3600 * 1000),
      endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      authorId,
    },
    {
      id: 'ban_003',
      title: 'Download Our Mobile App - Never Miss a Tender',
      description: 'Get instant WhatsApp and push alerts when tenders matching your trade are published.',
      linkUrl: '/mobile',
      position: 'sidebar',
      priority: 5,
      status: 'DRAFT' as const,
      startDate: null,
      endDate: null,
      authorId,
    },
  ];

  for (const ban of banners) {
    await prisma.banner.upsert({
      where: { id: ban.id },
      update: { ...ban },
      create: { ...ban },
    });
  }
  console.log(`Seeded ${banners.length} banners in PostgreSQL.`);

  const [postCnt, annCnt, banCnt] = await Promise.all([
    prisma.blogPost.count(),
    prisma.announcement.count(),
    prisma.banner.count(),
  ]);

  console.log(`\nVerified Database State -> ${postCnt} Posts, ${annCnt} Announcements, ${banCnt} Banners.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
