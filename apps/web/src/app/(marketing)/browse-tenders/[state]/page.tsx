import { Metadata } from 'next';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/* Data                                                               */
/* ------------------------------------------------------------------ */

const STATES = [
  'andhra-pradesh', 'arunachal-pradesh', 'assam', 'bihar', 'chhattisgarh',
  'goa', 'gujarat', 'haryana', 'himachal-pradesh', 'jharkhand', 'karnataka',
  'kerala', 'madhya-pradesh', 'maharashtra', 'manipur', 'meghalaya',
  'mizoram', 'nagaland', 'odisha', 'punjab', 'rajasthan', 'sikkim',
  'tamil-nadu', 'telangana', 'tripura', 'uttar-pradesh', 'uttarakhand',
  'west-bengal',
] as const;

const UNION_TERRITORIES = [
  'andaman-nicobar', 'chandigarh', 'dadra-nagar-haveli', 'daman-diu',
  'delhi', 'jammu-kashmir', 'ladakh', 'lakshadweep', 'puducherry',
] as const;

const ALL_REGIONS = [...STATES, ...UNION_TERRITORIES];

const CATEGORIES = [
  { slug: 'construction', label: 'Construction' },
  { slug: 'it-services', label: 'IT Services' },
  { slug: 'healthcare', label: 'Healthcare' },
  { slug: 'supplies', label: 'Supplies' },
  { slug: 'consulting', label: 'Consulting' },
  { slug: 'infrastructure', label: 'Infrastructure' },
];

const RELATED_STATES_MAP: Record<string, string[]> = {
  'andhra-pradesh': ['telangana', 'karnataka', 'tamil-nadu', 'maharashtra'],
  'delhi': ['uttar-pradesh', 'haryana', 'rajasthan', 'punjab'],
  'maharashtra': ['gujarat', 'karnataka', 'goa', 'madhya-pradesh'],
  'karnataka': ['tamil-nadu', 'kerala', 'andhra-pradesh', 'maharashtra'],
  'tamil-nadu': ['kerala', 'karnataka', 'andhra-pradesh', 'puducherry'],
};

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function slugToStateName(slug: string): string {
  const specialNames: Record<string, string> = {
    'andaman-nicobar': 'Andaman & Nicobar Islands',
    'dadra-nagar-haveli': 'Dadra & Nagar Haveli',
    'daman-diu': 'Daman & Diu',
    'jammu-kashmir': 'Jammu & Kashmir',
  };
  if (specialNames[slug]) return specialNames[slug];
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatINR(value: number): string {
  return value.toLocaleString('en-IN');
}

function getMockTenders(stateName: string) {
  const orgs = [
    'Public Works Department',
    'State Health Department',
    'Municipal Corporation',
    'State IT Department',
    'Water Resources Department',
    'Education Department',
    'Rural Development Department',
    'Transport Department',
    'Power Distribution Company',
    'Housing Board',
  ];
  const categories = ['Construction', 'IT Services', 'Healthcare', 'Supplies', 'Infrastructure', 'Consulting', 'Construction', 'Supplies', 'Infrastructure', 'Construction'];
  const titles = [
    `Construction of District Hospital Building in ${stateName}`,
    `Supply and Installation of IT Infrastructure for ${stateName} Secretariat`,
    `Procurement of Medical Equipment for PHCs in ${stateName}`,
    `Development of e-Governance Portal for ${stateName} Government`,
    `Construction of Irrigation Canal Network in ${stateName}`,
    `Consultancy for Smart City Project in ${stateName}`,
    `Road Construction and Maintenance Work in ${stateName}`,
    `Supply of Office Furniture and Equipment for ${stateName} Offices`,
    `Solar Power Plant Installation in ${stateName}`,
    `Construction of Affordable Housing Units in ${stateName}`,
  ];
  const values = [45000000, 12500000, 8700000, 35000000, 92000000, 15000000, 28000000, 3200000, 67000000, 125000000];
  const days = [3, 5, 7, 10, 12, 14, 2, 8, 15, 1];

  return titles.map((title, i) => ({
    id: `tender-${i + 1}`,
    title,
    organization: `${stateName} ${orgs[i]}`,
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
  return ALL_REGIONS.map((state) => ({ state }));
}

export function generateMetadata({
  params,
}: {
  params: { state: string };
}): Metadata {
  const stateName = slugToStateName(params.state);
  return {
    title: `Latest ${stateName} Government Tenders 2026`,
    description: `Find the latest government tenders in ${stateName}. Browse 1,200+ active tenders across construction, IT, healthcare and more.`,
    openGraph: {
      title: `Latest ${stateName} Government Tenders 2026 | TenderBazaar`,
      description: `Find the latest government tenders in ${stateName}. Browse 1,200+ active tenders across construction, IT, healthcare and more.`,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function StateTendersPage({
  params,
}: {
  params: { state: string };
}) {
  const stateName = slugToStateName(params.state);
  const tenders = getMockTenders(stateName);
  const relatedStates = RELATED_STATES_MAP[params.state] ?? ALL_REGIONS.filter((s) => s !== params.state).slice(0, 4);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <Link href="/" className="font-bold text-xl text-primary-500">
              TenderBazaar
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 transition-colors"
              >
                Sign up free
              </Link>
            </div>
          </div>
        </div>
      </nav>

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
            <li className="text-foreground font-medium">{stateName}</li>
          </ol>
        </nav>

        {/* H1 */}
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-6 tracking-tight">
          Government Tenders in {stateName} &mdash; 2026
        </h1>

        {/* Stats row */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-sm text-muted-foreground mb-1">Total Tenders</p>
            <p className="text-2xl font-bold text-foreground">3,847</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-sm text-muted-foreground mb-1">Active Tenders</p>
            <p className="text-2xl font-bold text-accent-500">1,234</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-sm text-muted-foreground mb-1">Closing Today</p>
            <p className="text-2xl font-bold text-primary-500">28</p>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content — tender list */}
          <div className="lg:col-span-2 space-y-4">
            {tenders.map((tender) => (
              <article
                key={tender.id}
                className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h2 className="text-lg font-semibold text-foreground leading-snug">
                    {tender.title}
                  </h2>
                  <span className="shrink-0 inline-flex items-center rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
                    {tender.category}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {tender.organization}
                </p>
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
            {/* Category filters */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold text-foreground mb-4">
                Browse by Category
              </h3>
              <ul className="space-y-2">
                {CATEGORIES.map((cat) => (
                  <li key={cat.slug}>
                    <Link
                      href={`/browse-tenders/${params.state}/${cat.slug}`}
                      className="text-sm text-muted-foreground hover:text-primary-500 transition-colors flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />
                      {cat.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recent tenders */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold text-foreground mb-4">
                Recently Added
              </h3>
              <ul className="space-y-3">
                {tenders.slice(0, 4).map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/dashboard/tenders/${t.id}`}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors line-clamp-2"
                    >
                      {t.title}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Closes: {t.deadline}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Related states */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold text-foreground mb-4">
                Tenders in Other States
              </h3>
              <ul className="space-y-2">
                {relatedStates.map((s) => (
                  <li key={s}>
                    <Link
                      href={`/browse-tenders/${s}`}
                      className="text-sm text-muted-foreground hover:text-primary-500 transition-colors"
                    >
                      {slugToStateName(s)} Tenders
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>

        {/* SEO content */}
        <section className="mt-12 bg-card border border-border rounded-xl p-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Government Tendering in {stateName}
          </h2>
          <div className="prose prose-sm max-w-none text-muted-foreground">
            <p className="mb-4">
              {stateName} is one of India&apos;s most active states in government procurement,
              publishing thousands of tenders each year across departments like Public Works,
              Health, Education, IT, and Rural Development. The {stateName} government uses its
              e-procurement portal along with the Central Public Procurement Portal (CPPP) and
              Government e-Marketplace (GeM) to ensure transparent and competitive bidding.
            </p>
            <p className="mb-4">
              Businesses registered as MSME, Class-I, or Class-II contractors in {stateName} have
              access to preferential policies including EMD exemptions, price preferences, and
              reserved procurement categories. TenderBazaar aggregates all {stateName} government
              tenders in one place, helping you discover opportunities you might otherwise miss.
            </p>
            <p>
              Whether you&apos;re a construction contractor, IT services provider, medical equipment
              supplier, or consulting firm, TenderBazaar&apos;s AI-powered eligibility checker
              instantly tells you which {stateName} tenders you qualify for, saving you hours of
              manual review.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-10 bg-card rounded-2xl p-8 md:p-12 text-center border border-border">
          <h2 className="text-2xl font-bold text-foreground mb-3">
            Get Daily {stateName} Tender Alerts
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Sign up to receive daily alerts for new tenders in {stateName}.
            Never miss a government contract opportunity again.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-lg bg-primary-500 px-8 py-3 text-base font-semibold text-white hover:bg-primary-600 transition-colors shadow-lg shadow-primary-500/25"
          >
            Sign up for free alerts
          </Link>
        </section>
      </div>
    </div>
  );
}
