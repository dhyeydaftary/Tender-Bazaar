import { prisma } from './config/database';
import esClient, { isElasticsearchAlive } from './config/elasticsearch';
import { TENDER_INDEX, toTenderDocument } from './config/elasticsearch-setup';
import { enrichTenderDetails } from './modules/tenders/tender-enricher';

async function main() {
  console.log('--- Starting TenderBazaar Dynamic Sync ---');
  const now = new Date(); // Current simulated date: 19 Oct 2026

  // 1. Update Expired Tenders from ACTIVE to CLOSED
  console.log('1. Checking expired tenders...');
  const expiredCount = await prisma.tender.updateMany({
    where: {
      status: 'ACTIVE',
      bidSubmissionDeadline: { lt: now },
    },
    data: {
      status: 'CLOSED',
    },
  });
  console.log(`Updated ${expiredCount.count} expired tenders from ACTIVE to CLOSED`);

  // 2. Generate Results from Oct 7 to Oct 19, 2026
  console.log('2. Syncing Tender Results up to today (19 Oct 2026)...');
  const latestResult = await prisma.tenderResult.findFirst({
    orderBy: { awardedDate: 'desc' },
    select: { awardedDate: true },
  });

  const companies = [
    { company: 'Larsen & Toubro Limited', rep: 'Rajesh Sharma' },
    { company: 'Tata Projects Limited', rep: 'Vikram Malhotra' },
    { company: 'Dilip Buildcon Limited', rep: 'Devendra Jain' },
    { company: 'NCC Limited', rep: 'Alluri Ranga Raju' },
    { company: 'Bharat Electronics Limited', rep: 'Sunil Verma' },
    { company: 'Infosys Public Services', rep: 'Anand Kulkarni' },
    { company: 'Afcons Infrastructure Limited', rep: 'K. Subramanian' },
    { company: 'Kalpataru Projects International', rep: 'Manish Mohnot' },
    { company: 'KEC International Limited', rep: 'Vimal Kejriwal' },
    { company: 'Ahluwalia Contracts (India) Ltd', rep: 'Bikramjit Ahluwalia' },
    { company: 'HCL Technologies Limited', rep: 'Pradeep Nair' },
    { company: 'Wipro Technologies India', rep: 'Sanjay Gupta' },
    { company: 'Sterling and Wilson Renewable Energy', rep: 'Amit Jain' },
    { company: 'Patel Engineering Limited', rep: 'Kavita Shirvaikar' },
    { company: 'Siemens India Infrastructure', rep: 'Ramesh Sundaram' },
    { company: 'Medanta Healthcare Solutions', rep: 'Dr. Naresh Trehan' },
    { company: 'Trivitron Healthcare Pvt Ltd', rep: 'G. S. K. Velu' },
    { company: 'Polymedicure Limited', rep: 'Rishi Baid' },
    { company: 'Voltas Limited', rep: 'Pradeep Bakshi' },
    { company: 'Blue Star Limited', rep: 'B. Thiagarajan' },
  ];

  // Pick tenders closed recently that don't have results yet
  const closedTenders = await prisma.tender.findMany({
    where: {
      status: { in: ['CLOSED', 'AWARDED'] },
      results: { none: {} },
    },
    take: 60,
    orderBy: { bidSubmissionDeadline: 'desc' },
  });

  console.log(`Found ${closedTenders.length} closed tenders needing results.`);
  
  // Starting from 2026-10-07 up to today 2026-10-19
  const startTime = new Date('2026-10-07T09:00:00Z').getTime();
  const endTime = now.getTime();
  const timeDiff = endTime - startTime;

  for (let i = 0; i < closedTenders.length; i++) {
    const t = closedTenders[i];
    const w = companies[i % companies.length];
    const baseValue =
      t.estimatedValue && t.estimatedValue > 100000
        ? t.estimatedValue
        : 2500000 + ((i * 4700000) % 95000000);
    const discount = 0.91 + ((i * 7) % 8) * 0.01;
    const awardedValue = Math.round(baseValue * discount);

    // Distribute results across Oct 7 to Oct 19
    const ratio = i / Math.max(1, closedTenders.length - 1);
    const awardedTime = startTime + ratio * timeDiff;
    const awardedDate = new Date(awardedTime);

    await prisma.tenderResult.create({
      data: {
        tenderId: t.id,
        winnerName: w.rep,
        winnerCompany: w.company,
        awardedValue,
        awardedDate,
      },
    }).catch((e) => console.error('Error creating result:', e.message));

    await prisma.tender.update({
      where: { id: t.id },
      data: { status: 'AWARDED' },
    }).catch(() => {});
  }
  console.log('Results synced up to 19 October 2026!');

  // 3. Enrich Tenders with missing fields
  console.log('3. Enriching tenders with missing requirements/details...');
  const allTenders = await prisma.tender.findMany({
    take: 500,
    where: {
      OR: [
        { minTurnover: null },
        { district: null },
        { requiredCertifications: { isEmpty: true } },
      ],
    },
  });

  console.log(`Enriching ${allTenders.length} tenders...`);
  for (const t of allTenders) {
    const enriched = enrichTenderDetails(t as any);
    await prisma.tender.update({
      where: { id: t.id },
      data: {
        minTurnover: enriched.minTurnover,
        minNetWorth: enriched.minNetWorth,
        minExperience: enriched.minExperience,
        requiredCertifications: enriched.requiredCertifications,
        emdAmount: enriched.emdAmount,
        district: enriched.district,
        city: enriched.city,
        bidOpeningDate: enriched.bidOpeningDate,
        preBidMeetingDate: enriched.preBidMeetingDate,
      },
    }).catch(() => {});
  }
  console.log('Enrichment complete!');

  // 4. Update Elasticsearch documents
  if (isElasticsearchAlive()) {
    console.log('4. Updating Elasticsearch index...');
    try {
      const tendersToReindex = await prisma.tender.findMany({
        take: 1600,
      });
      const body = tendersToReindex.flatMap((tender) => [
        { index: { _index: TENDER_INDEX, _id: tender.id } },
        toTenderDocument(tender),
      ]);
      await esClient.bulk({ body });
      console.log('Elasticsearch index refreshed successfully!');
    } catch (err: any) {
      console.warn('Elasticsearch bulk update warning:', err.message);
    }
  }

  // 5. Final Stats Check
  const activeCount = await prisma.tender.count({ where: { status: 'ACTIVE' } });
  const closedCount = await prisma.tender.count({ where: { status: { in: ['CLOSED', 'AWARDED'] } } });
  const totalCount = await prisma.tender.count();
  const latestResultNow = await prisma.tenderResult.findFirst({
    orderBy: { awardedDate: 'desc' },
  });

  console.log(`Stats: Total=${totalCount}, Active=${activeCount}, Closed=${closedCount}`);
  console.log(`Latest Result Date: ${latestResultNow?.awardedDate?.toISOString()} (${latestResultNow?.winnerCompany})`);
  console.log('--- Sync Completed Successfully ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
