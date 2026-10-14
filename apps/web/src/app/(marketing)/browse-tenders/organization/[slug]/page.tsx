import { Metadata } from 'next';
import Link from 'next/link';
import { OrgStatsRow } from './org-stats-row';

/* ------------------------------------------------------------------ */
/* Data                                                               */
/* ------------------------------------------------------------------ */

interface Organization {
  slug: string;
  name: string;
  fullName: string;
  description: string;
  website: string;
  sector: string;
  totalTenders: number;
  activeTenders: number;
  avgValue: number;
}

const ORGANIZATIONS: Organization[] = [
  {
    slug: 'nhai',
    name: 'NHAI',
    fullName: 'National Highways Authority of India',
    description: 'NHAI is responsible for the development, maintenance, and management of National Highways across India. It is one of the largest issuers of infrastructure tenders in the country.',
    website: 'https://nhai.gov.in',
    sector: 'Infrastructure',
    totalTenders: 4520,
    activeTenders: 312,
    avgValue: 85000000,
  },
  {
    slug: 'indian-railways',
    name: 'Indian Railways',
    fullName: 'Indian Railways',
    description: 'Indian Railways is the largest employer in India and one of the biggest railway networks in the world. It regularly procures rolling stock, infrastructure, IT services, and supplies.',
    website: 'https://indianrailways.gov.in',
    sector: 'Transport',
    totalTenders: 8950,
    activeTenders: 587,
    avgValue: 42000000,
  },
  {
    slug: 'gem',
    name: 'GeM',
    fullName: 'Government e-Marketplace',
    description: 'GeM is the national public procurement portal for government buyers and sellers. It offers an end-to-end online marketplace for procurement of goods and services.',
    website: 'https://gem.gov.in',
    sector: 'Procurement',
    totalTenders: 25000,
    activeTenders: 3200,
    avgValue: 5500000,
  },
  {
    slug: 'cpwd',
    name: 'CPWD',
    fullName: 'Central Public Works Department',
    description: 'CPWD is the premier construction agency of the Government of India. It handles civil construction, electrical installations, horticulture, and maintenance of government assets.',
    website: 'https://cpwd.gov.in',
    sector: 'Construction',
    totalTenders: 3800,
    activeTenders: 245,
    avgValue: 65000000,
  },
  {
    slug: 'bhel',
    name: 'BHEL',
    fullName: 'Bharat Heavy Electricals Limited',
    description: 'BHEL is India\'s largest engineering and manufacturing enterprise in the energy and infrastructure sectors, producing heavy electrical equipment and power plant components.',
    website: 'https://bhel.com',
    sector: 'Energy',
    totalTenders: 2100,
    activeTenders: 178,
    avgValue: 120000000,
  },
  {
    slug: 'ntpc',
    name: 'NTPC',
    fullName: 'NTPC Limited',
    description: 'NTPC is India\'s largest energy conglomerate, engaged in the generation of electricity and allied activities. It procures fuel, equipment, and services for its power plants.',
    website: 'https://ntpc.co.in',
    sector: 'Energy',
    totalTenders: 1850,
    activeTenders: 142,
    avgValue: 95000000,
  },
  {
    slug: 'ongc',
    name: 'ONGC',
    fullName: 'Oil and Natural Gas Corporation',
    description: 'ONGC is India\'s largest crude oil and natural gas company, contributing around 70% of Indian domestic production. It procures drilling equipment, services, and supplies.',
    website: 'https://ongcindia.com',
    sector: 'Oil & Gas',
    totalTenders: 2400,
    activeTenders: 198,
    avgValue: 150000000,
  },
  {
    slug: 'sail',
    name: 'SAIL',
    fullName: 'Steel Authority of India Limited',
    description: 'SAIL is one of the largest steel-making companies in India, with five integrated steel plants. It procures raw materials, equipment, and maintenance services.',
    website: 'https://sail.co.in',
    sector: 'Steel',
    totalTenders: 1600,
    activeTenders: 120,
    avgValue: 75000000,
  },
  {
    slug: 'drdo',
    name: 'DRDO',
    fullName: 'Defence Research and Development Organisation',
    description: 'DRDO is the R&D wing of the Ministry of Defence. It develops defence technologies and procures specialised equipment, materials, and research services.',
    website: 'https://drdo.gov.in',
    sector: 'Defence',
    totalTenders: 1200,
    activeTenders: 95,
    avgValue: 45000000,
  },
  {
    slug: 'isro',
    name: 'ISRO',
    fullName: 'Indian Space Research Organisation',
    description: 'ISRO is India\'s space agency responsible for space exploration and satellite technology. It procures specialised components, materials, and technical services.',
    website: 'https://isro.gov.in',
    sector: 'Space & Technology',
    totalTenders: 680,
    activeTenders: 52,
    avgValue: 35000000,
  },
  {
    slug: 'aiims',
    name: 'AIIMS',
    fullName: 'All India Institute of Medical Sciences',
    description: 'AIIMS is a group of autonomous public medical colleges of higher education. It procures medical equipment, pharmaceuticals, and hospital management services.',
    website: 'https://aiims.edu',
    sector: 'Healthcare',
    totalTenders: 950,
    activeTenders: 78,
    avgValue: 15000000,
  },
  {
    slug: 'iit',
    name: 'IIT',
    fullName: 'Indian Institutes of Technology',
    description: 'IITs are autonomous public technical universities. They procure lab equipment, IT infrastructure, construction services, and research materials.',
    website: 'https://iitsystem.ac.in',
    sector: 'Education',
    totalTenders: 1100,
    activeTenders: 89,
    avgValue: 12000000,
  },
  {
    slug: 'bsnl',
    name: 'BSNL',
    fullName: 'Bharat Sanchar Nigam Limited',
    description: 'BSNL is a government-owned telecommunications company providing telecom services across India. It procures network equipment, fibre optic cables, and IT services.',
    website: 'https://bsnl.co.in',
    sector: 'Telecom',
    totalTenders: 1750,
    activeTenders: 134,
    avgValue: 55000000,
  },
  {
    slug: 'nhpc',
    name: 'NHPC',
    fullName: 'NHPC Limited',
    description: 'NHPC is India\'s premier hydropower company. It develops, constructs, and operates hydroelectric power projects and procures turbines, civil works, and engineering services.',
    website: 'https://nhpcindia.com',
    sector: 'Energy',
    totalTenders: 820,
    activeTenders: 64,
    avgValue: 110000000,
  },
  {
    slug: 'coal-india',
    name: 'Coal India',
    fullName: 'Coal India Limited',
    description: 'Coal India is the world\'s largest coal-producing company, operating through its subsidiaries across India. It procures heavy earth-moving equipment, transport services, and mining supplies.',
    website: 'https://coalindia.in',
    sector: 'Mining',
    totalTenders: 2200,
    activeTenders: 175,
    avgValue: 88000000,
  },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatINR(value: number): string {
  return value.toLocaleString('en-IN');
}

function getOrgBySlug(slug: string): Organization | undefined {
  return ORGANIZATIONS.find((o) => o.slug === slug);
}

function getMockOrgTenders(org: Organization) {
  const titles = [
    `Supply of specialised equipment for ${org.name} operations`,
    `Annual maintenance contract for ${org.name} facilities`,
    `IT infrastructure upgrade for ${org.name} offices`,
    `Consultancy services for ${org.name} expansion project`,
    `Civil construction work at ${org.name} premises`,
    `Procurement of vehicles for ${org.name} field operations`,
    `Security services for ${org.name} installations`,
    `Environmental compliance audit for ${org.name}`,
  ];
  const values = [25000000, 8500000, 18000000, 12000000, 45000000, 6500000, 3200000, 4800000];
  const days = [5, 8, 3, 12, 7, 10, 2, 14];
  const categories = ['Supplies', 'Services', 'IT Services', 'Consulting', 'Construction', 'Supplies', 'Services', 'Consulting'];

  return titles.map((title, i) => ({
    id: `org-tender-${i + 1}`,
    title,
    category: categories[i],
    estimatedValue: values[i],
    deadline: `2026-04-${String(10 + days[i]).padStart(2, '0')}`,
    daysLeft: days[i],
  }));
}

/* ------------------------------------------------------------------ */
/* Static params & metadata                                           */
/* ------------------------------------------------------------------ */

export function generateStaticParams() {
  return ORGANIZATIONS.map((org) => ({ slug: org.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const org = getOrgBySlug(params.slug);
  const name = org?.name ?? params.slug.toUpperCase();
  const fullName = org?.fullName ?? name;
  return {
    title: `${name} Tenders 2026 — Latest Opportunities`,
    description: `Browse the latest tenders from ${fullName}. Find active government contract opportunities, bid deadlines, and estimated values from ${name}.`,
    openGraph: {
      title: `${name} Tenders 2026 — Latest Opportunities | TenderBazaar`,
      description: `Browse the latest tenders from ${fullName}. Find active government contract opportunities, bid deadlines, and estimated values from ${name}.`,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function OrganizationPage({
  params,
}: {
  params: { slug: string };
}) {
  const org = getOrgBySlug(params.slug);

  if (!org) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Organisation Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The organisation you are looking for does not exist.
          </p>
          <Link href="/" className="text-primary-500 hover:text-primary-600 font-medium">
            Go back home
          </Link>
        </div>
      </div>
    );
  }

  const tenders = getMockOrgTenders(org);

  return (
    <div className="min-h-screen bg-background pt-16 sm:pt-20">
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-2 text-sm text-muted-foreground">
            <li>
              <Link href="/" className="hover:text-foreground transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true">&gt;</li>
            <li>
              <Link href="/tenders" className="hover:text-foreground transition-colors">
                Tenders
              </Link>
            </li>
            <li aria-hidden="true">&gt;</li>
            <li>
              <Link
                href="/browse-tenders/organization"
                className="hover:text-foreground transition-colors"
              >
                Organisations
              </Link>
            </li>
            <li aria-hidden="true">&gt;</li>
            <li className="text-foreground font-medium">{org.name}</li>
          </ol>
        </nav>

        {/* Organisation header */}
        <section className="bg-card border border-border rounded-xl p-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                  {org.name}
                </h1>
                <span className="inline-flex items-center rounded-full bg-accent-100 px-3 py-1 text-xs font-medium text-accent-700 dark:bg-accent-500/20 dark:text-accent-400">
                  {org.sector}
                </span>
              </div>
              <p className="text-lg text-muted-foreground mb-3">{org.fullName}</p>
              <p className="text-sm text-muted-foreground max-w-2xl">{org.description}</p>
            </div>
            <a
              href={org.website}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 text-sm font-medium text-primary-500 hover:text-primary-600 transition-colors"
            >
              Visit official website &nearr;
            </a>
          </div>
        </section>

        {/* Real Dynamic Stats */}
        <OrgStatsRow
          orgName={org.name}
          fallbackTotal={org.totalTenders}
          fallbackActive={org.activeTenders}
          fallbackAvgValue={org.avgValue}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Tender list */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Latest {org.name} Tenders
            </h2>
            {tenders.map((tender) => (
              <article
                key={tender.id}
                className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h3 className="text-lg font-semibold text-foreground leading-snug">
                    {tender.title}
                  </h3>
                  <span className="shrink-0 inline-flex items-center rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
                    {tender.category}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm mb-4">
                  <span className="text-foreground font-medium">
                    Est. Value: &#8377;{formatINR(tender.estimatedValue)}
                  </span>
                  <span className="text-muted-foreground">|</span>
                  <span
                    className={
                      tender.daysLeft <= 3
                        ? 'text-red-500 font-medium'
                        : 'text-muted-foreground'
                    }
                  >
                    Deadline: {tender.deadline} ({tender.daysLeft} day{tender.daysLeft !== 1 ? 's' : ''} left)
                  </span>
                </div>
                <Link
                  href={`/dashboard/tenders/${tender.id}`}
                  className="inline-flex items-center text-sm font-semibold text-primary-500 hover:text-primary-600 transition-colors"
                >
                  View Details &rarr;
                </Link>
              </article>
            ))}
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Organisation info */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold text-foreground mb-4">
                About {org.name}
              </h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Full Name</dt>
                  <dd className="text-foreground font-medium">{org.fullName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Sector</dt>
                  <dd className="text-foreground font-medium">{org.sector}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Website</dt>
                  <dd>
                    <a
                      href={org.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-500 hover:text-primary-600 font-medium"
                    >
                      {org.website.replace('https://', '')}
                    </a>
                  </dd>
                </div>
              </dl>
            </div>

            {/* Other organisations */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold text-foreground mb-4">
                Other Organisations
              </h3>
              <ul className="space-y-2">
                {ORGANIZATIONS.filter((o) => o.slug !== org.slug)
                  .slice(0, 6)
                  .map((o) => (
                    <li key={o.slug}>
                      <Link
                        href={`/browse-tenders/organization/${o.slug}`}
                        className="text-sm text-muted-foreground hover:text-primary-500 transition-colors flex items-center gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />
                        {o.name} ({formatINR(o.activeTenders)} active)
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>

            {/* CTA sidebar */}
            <div className="bg-card rounded-xl p-6 text-foreground">
              <h3 className="text-base font-semibold mb-2">
                Track {org.name} tenders
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get instant alerts when {org.name} publishes new tenders.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center justify-center w-full rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition-colors"
              >
                Set up alerts
              </Link>
            </div>
          </aside>
        </div>

        {/* SEO content */}
        <section className="mt-12 bg-card border border-border rounded-xl p-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            About {org.fullName} Tenders
          </h2>
          <div className="prose prose-sm max-w-none text-muted-foreground">
            <p className="mb-4">
              {org.fullName} ({org.name}) is one of the major government organisations
              in India&apos;s {org.sector.toLowerCase()} sector. With over{' '}
              {formatINR(org.totalTenders)} tenders published to date, {org.name} is
              a significant source of business opportunities for contractors, suppliers,
              and service providers across the country.
            </p>
            <p className="mb-4">
              {org.name} publishes its tenders through multiple channels including the
              Central Public Procurement Portal (CPPP), Government e-Marketplace (GeM),
              and its own e-procurement portal. Tenders typically cover areas such as
              equipment procurement, civil works, IT services, consultancy, and annual
              maintenance contracts.
            </p>
            <p>
              TenderBazaar aggregates all {org.name} tenders in one place, giving you
              a single dashboard to track opportunities. Our AI-powered eligibility
              checker instantly analyses your company profile against tender requirements,
              helping you focus only on the contracts you can win.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
