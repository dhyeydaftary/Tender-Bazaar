import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Seeding Realistic Bookmarks Across All Tenders ---');

  // 1. Ensure at least 80 active bidder users exist (excluding real user accounts)
  const existingUsers = await prisma.user.findMany({
    where: {
      role: 'USER',
      email: {
        notIn: ['nakshatrah2410@gmail.com', 'demouser@gmail.com'],
      },
    },
    select: { id: true, email: true },
  });

  const bidderCountNeeded = 80 - existingUsers.length;
  const userIds: string[] = existingUsers.map((u) => u.id);

  if (bidderCountNeeded > 0) {
    console.log(`Creating ${bidderCountNeeded} additional bidder accounts...`);
    const defaultPasswordHash = await bcrypt.hash('Bidder@123', 10);
    const firstNames = ['Vikram', 'Ananya', 'Rohit', 'Pooja', 'Karan', 'Sneha', 'Deepak', 'Meera', 'Arjun', 'Divya', 'Sanjay', 'Kavita', 'Manish', 'Ritu', 'Naveen', 'Swati', 'Alok', 'Tanvi', 'Harish', 'Preeti'];
    const lastNames = ['Sharma', 'Verma', 'Patel', 'Reddy', 'Singh', 'Gupta', 'Mehta', 'Nair', 'Joshi', 'Chopra', 'Yadav', 'Kulkarni', 'Agarwal', 'Bose', 'Rao', 'Shah', 'Pandey', 'Saxena', 'Iyer', 'Deshmukh'];

    for (let i = 0; i < bidderCountNeeded; i++) {
      const fn = firstNames[i % firstNames.length];
      const ln = lastNames[(i * 3) % lastNames.length];
      const email = `bidder.${fn.toLowerCase()}.${ln.toLowerCase()}.${i + 1}@bidcorp.in`;

      try {
        const user = await prisma.user.upsert({
          where: { email },
          update: {},
          create: {
            name: `${fn} ${ln}`,
            email,
            passwordHash: defaultPasswordHash,
            role: 'USER',
            isEmailVerified: true,
          },
        });
        userIds.push(user.id);
      } catch (err) {
        // ignore unique constraint
      }
    }
  }

  console.log(`Total available bidder users: ${userIds.length}`);

  // 2. Fetch all tenders
  const tenders = await prisma.tender.findMany({
    select: { id: true, title: true, category: true, viewCount: true },
  });
  console.log(`Found ${tenders.length} tenders to enrich with bookmarks`);

  // Target bookmark counts per category / rank
  // Give top tenders between 25 and 65 bookmarks, others between 5 and 24 bookmarks
  let totalBookmarksCreated = 0;

  for (let i = 0; i < tenders.length; i++) {
    const tender = tenders[i];

    // Determine target bookmark count based on index / popularity
    let targetCount = 5;
    if (i === 0) targetCount = 64;
    else if (i === 1) targetCount = 58;
    else if (i === 2) targetCount = 52;
    else if (i === 3) targetCount = 47;
    else if (i === 4) targetCount = 42;
    else if (i === 5) targetCount = 38;
    else if (i === 6) targetCount = 33;
    else if (i === 7) targetCount = 29;
    else if (i === 8) targetCount = 26;
    else if (i === 9) targetCount = 22;
    else {
      // For all other tenders, distribute between 4 and 20 bookmarks
      targetCount = 4 + ((i * 7 + 13) % 17);
    }

    // Check existing bookmarks for this tender
    const currentSaved = await prisma.savedTender.findMany({
      where: { tenderId: tender.id },
      select: { userId: true },
    });
    const currentSavedUserIds = new Set(currentSaved.map((s) => s.userId));

    const needed = targetCount - currentSaved.length;
    if (needed > 0) {
      // Pick random users who haven't saved this tender yet
      const candidateUsers = userIds.filter((uid) => !currentSavedUserIds.has(uid));
      // Shuffle candidates deterministically
      const shuffled = [...candidateUsers].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, needed);

      for (const uid of selected) {
        try {
          await prisma.savedTender.create({
            data: {
              userId: uid,
              tenderId: tender.id,
            },
          });
          totalBookmarksCreated++;
        } catch {
          // ignore duplicate
        }
      }
    }

    // Also ensure viewCount is realistic and greater than bookmark count
    if (tender.viewCount < targetCount * 3) {
      const realisticViews = targetCount * 4 + ((i * 19 + 7) % 50);
      await prisma.tender.update({
        where: { id: tender.id },
        data: { viewCount: realisticViews },
      });
    }
  }

  console.log(`Successfully created ${totalBookmarksCreated} new bookmark records.`);

  // Verify top 10 most saved tenders
  const topSaved = await prisma.tender.findMany({
    orderBy: { savedBy: { _count: 'desc' } },
    take: 10,
    select: {
      id: true,
      title: true,
      category: true,
      viewCount: true,
      _count: { select: { savedBy: true } },
    },
  });

  console.log('\nTop 10 Most Saved Tenders in Database:');
  topSaved.forEach((t, idx) => {
    console.log(`${idx + 1}. [${t.category}] ${t.title.slice(0, 45)}... -> Bookmarks: ${t._count.savedBy}, Views: ${t.viewCount}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
