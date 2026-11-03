const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const WINNER_COMPANIES = [
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
  { company: 'BEML Limited', rep: 'Shantanu Roy' },
  { company: 'Shapoorji Pallonji & Co Ltd', rep: 'Feroze Mistry' },
  { company: 'IRCON International Ltd', rep: 'Brijesh Kumar' },
  { company: 'Rail Vikas Nigam Limited (RVNL)', rep: 'Pradeep Gaur' },
  { company: 'Voltas Limited (Tata Enterprise)', rep: 'Pradeep Bakshi' },
  { company: 'Thermax Limited', rep: 'Ashish Bhandari' },
  { company: 'Blue Star Limited', rep: 'B. Thiagarajan' },
];

async function seedResults() {
  console.log('Checking existing tenders...');
  const tenders = await prisma.tender.findMany({
    take: 60,
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${tenders.length} tenders.`);
  if (tenders.length === 0) {
    console.log('No tenders found to attach results to!');
    return;
  }

  const existingCount = await prisma.tenderResult.count();
  console.log(`Current TenderResult count: ${existingCount}`);

  let created = 0;
  const sampleTenders = tenders.slice(0, 42);

  for (let i = 0; i < sampleTenders.length; i++) {
    const tender = sampleTenders[i];
    const winner = WINNER_COMPANIES[i % WINNER_COMPANIES.length];

    const baseValue = tender.estimatedValue && tender.estimatedValue > 100000
      ? tender.estimatedValue
      : (5000000 + (i * 12500000) % 80000000);

    const discount = 0.91 + ((i * 7) % 8) * 0.01;
    const awardedValue = Math.round(baseValue * discount);

    const daysAgo = 3 + (i * 4) % 85;
    const awardedDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    await prisma.tenderResult.create({
      data: {
        tenderId: tender.id,
        winnerName: winner.rep,
        winnerCompany: winner.company,
        awardedValue,
        awardedDate,
      },
    });

    await prisma.tender.update({
      where: { id: tender.id },
      data: { status: 'AWARDED' },
    });

    created++;
  }

  console.log(`Successfully created ${created} TenderResult records!`);
  const total = await prisma.tenderResult.count();
  console.log(`Total TenderResult count in DB now: ${total}`);
}

seedResults()
  .catch((err) => {
    console.error('Error seeding results:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
