import { Metadata } from 'next';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/* Data                                                               */
/* ------------------------------------------------------------------ */

const TOP_STATES = [
  'maharashtra', 'uttar-pradesh', 'karnataka', 'tamil-nadu', 'delhi',
  'gujarat', 'rajasthan', 'west-bengal', 'telangana', 'kerala',
];

const CATEGORIES = [
  { slug: 'construction', label: 'Construction' },
  { slug: 'it-services', label: 'IT Services' },
  { slug: 'healthcare', label: 'Healthcare' },
  { slug: 'supplies', label: 'Supplies' },
  { slug: 'consulting', label: 'Consulting' },
  { slug: 'infrastructure', label: 'Infrastructure' },
];

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

function slugToCategory(slug: string): string {
  const specialNames: Record<string, string> = {
    'it-services': 'IT Services',
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

function getMockCategoryTenders(stateName: string, categoryName: string) {
  const categoryTitles: Record<string, string[]> = {
    Construction: [
      `Construction of Government Office Complex in ${stateName}`,
      `Road widening and resurfacing project in ${stateName}`,
      `Construction of Community Health Centre in ${stateName}`,
      `Bridge construction over river in ${stateName}`,
      `Construction of Government School Building in ${stateName}`,
      `Boundary wall construction for Government premises in ${stateName}`,
      `Renovation of heritage building in ${stateName}`,
      `Construction of staff quarters in ${stateName}`,
    ],
    'IT Services': [
      `Development of e-Governance portal for ${stateName}`,
      `Cloud infrastructure migration for ${stateName} departments`,
      `Cybersecurity audit and implementation in ${stateName}`,
      `ERP system implementation for ${stateName} government`,
      `Data centre setup and management in ${stateName}`,
      `Mobile app development for citizen services in ${stateName}`,
      `Network infrastructure upgrade in ${stateName}`,
      `AI/ML pilot project for governance in ${stateName}`,
    ],
    Healthcare: [
      `Supply of medical equipment for district hospitals in ${stateName}`,
      `Procurement of medicines for PHCs in ${stateName}`,
      `Hospital management software for ${stateName} health department`,
      `Ambulance procurement and maintenance in ${stateName}`,
      `Setting up diagnostic labs in ${stateName}`,
      `Medical waste management services in ${stateName}`,
      `Telemedicine infrastructure in ${stateName}`,
      `Blood bank equipment supply in ${stateName}`,
    ],
    Supplies: [
      `Supply of office stationery for ${stateName} departments`,
      `Procurement of uniforms for ${stateName} police`,
      `Supply of furniture for government offices in ${stateName}`,
      `Vehicle procurement for ${stateName} government fleet`,
      `Supply of lab equipment for universities in ${stateName}`,
      `Procurement of sports equipment for ${stateName} stadiums`,
      `Supply of solar panels for government buildings in ${stateName}`,
      `Canteen supplies for ${stateName} Secretariat`,
    ],
    Consulting: [
      `Feasibility study for metro rail extension in ${stateName}`,
      `Environmental impact assessment for industrial zone in ${stateName}`,
      `Financial advisory for PPP projects in ${stateName}`,
      `Urban planning consultancy for smart city in ${stateName}`,
      `Legal advisory for land acquisition in ${stateName}`,
      `Project management consultancy for highway project in ${stateName}`,
      `HR consultancy for ${stateName} government restructuring`,
      `Tourism development master plan for ${stateName}`,
    ],
    Infrastructure: [
      `Highway construction and maintenance in ${stateName}`,
      `Water supply pipeline network in ${stateName}`,
      `Sewerage treatment plant construction in ${stateName}`,
      `Railway over-bridge construction in ${stateName}`,
      `Flyover construction in ${stateName} capital city`,
      `Irrigation canal modernisation in ${stateName}`,
      `Smart street lighting project in ${stateName}`,
      `Flood control embankment work in ${stateName}`,
    ],
  };

  const titles = categoryTitles[categoryName] ?? categoryTitles['Construction']!;
  const orgs = [
    `${stateName} Public Works Department`,
    `${stateName} ${categoryName} Division`,
    'Municipal Corporation',
    `State ${categoryName} Board`,
    `${stateName} Development Authority`,
    `District Administration`,
    `${stateName} State Agency`,
    `${stateName} Government Secretariat`,
  ];
  const values = [32000000, 18500000, 7500000, 45000000, 12000000, 9800000, 55000000, 22000000];
  const days = [4, 7, 2, 11, 6, 9, 14, 3];

  return titles.map((title, i) => ({
    id: `cat-tender-${i + 1}`,
    title,
    organization: orgs[i],
    estimatedValue: values[i],
    deadline: `2026-04-${String(10 + days[i]).padStart(2, '0')}`,
    daysLeft: days[i],
  }));
}

/* ------------------------------------------------------------------ */
/* Static params & metadata                                           */
/* ------------------------------------------------------------------ */

export function generateStaticParams() {
  const params: { state: string; category: string }[] = [];
  for (const state of TOP_STATES) {
    for (const cat of CATEGORIES) {
      params.push({ state, category: cat.slug });
    }
  }
  return params;
}

export function generateMetadata({
  params,
}: {
  params: { state: string; category: string };
}): Metadata {
  const stateName = slugToStateName(params.state);
  const categoryName = slugToCategory(params.category);
  return {
    title: `${categoryName} Tenders in ${stateName} 2026`,
    description: `Browse the latest ${categoryName.toLowerCase()} tenders in ${stateName}. Find government contract opportunities, bid deadlines, and estimated values.`,
    openGraph: {
      title: `${categoryName} Tenders in ${stateName} 2026 | TenderBazaar`,
      description: `Browse the latest ${categoryName.toLowerCase()} tenders in ${stateName}. Find government contract opportunities, bid deadlines, and estimated values.`,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function StateCategoryPage({
  params,
}: {
  params: { state: string; category: string };
}) {
  const stateName = slugToStateName(params.state);
  const categoryName = slugToCategory(params.category);
  const tenders = getMockCategoryTenders(stateName, categoryName);

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
                href={`/browse-tenders/${params.state}`}
                className="hover:text-foreground transition-colors"
              >
                {stateName}
              </Link>
            </li>
            <li aria-hidden="true">&gt;</li>
            <li className="text-foreground font-medium">{categoryName}</li>
          </ol>
        </nav>

        {/* H1 */}
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2 tracking-tight">
          {categoryName} Tenders in {stateName}
        </h1>
        <p className="text-muted-foreground mb-8">
          Showing {tenders.length} active {categoryName.toLowerCase()} tenders
          in {stateName} for 2026
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-4">
            {tenders.map((tender) => (
              <article
                key={tender.id}
                className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow"
              >
                <h2 className="text-lg font-semibold text-foreground leading-snug mb-2">
                  {tender.title}
                </h2>
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
            {/* Related categories */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold text-foreground mb-4">
                Other Categories in {stateName}
              </h3>
              <ul className="space-y-2">
                {CATEGORIES.filter((c) => c.slug !== params.category).map((cat) => (
                  <li key={cat.slug}>
                    <Link
                      href={`/browse-tenders/${params.state}/${cat.slug}`}
                      className="text-sm text-muted-foreground hover:text-primary-500 transition-colors flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />
                      {cat.label} Tenders
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Same category in other states */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold text-foreground mb-4">
                {categoryName} Tenders in Other States
              </h3>
              <ul className="space-y-2">
                {TOP_STATES.filter((s) => s !== params.state)
                  .slice(0, 5)
                  .map((s) => (
                    <li key={s}>
                      <Link
                        href={`/browse-tenders/${s}/${params.category}`}
                        className="text-sm text-muted-foreground hover:text-primary-500 transition-colors"
                      >
                        {slugToStateName(s)}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>

            {/* All state tenders */}
            <div className="bg-card rounded-xl p-6 text-foreground">
              <h3 className="text-base font-semibold mb-2">
                See all {stateName} tenders
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                View tenders across all categories in {stateName}.
              </p>
              <Link
                href={`/browse-tenders/${params.state}`}
                className="inline-flex items-center text-sm font-semibold text-primary-400 hover:text-primary-300 transition-colors"
              >
                Browse all categories &rarr;
              </Link>
            </div>
          </aside>
        </div>

        {/* SEO content */}
        <section className="mt-12 bg-card border border-border rounded-xl p-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            {categoryName} Tendering in {stateName}
          </h2>
          <div className="prose prose-sm max-w-none text-muted-foreground">
            <p className="mb-4">
              The {categoryName.toLowerCase()} sector in {stateName} represents a significant
              portion of government procurement spending. Each year, the {stateName} government
              and its affiliated departments publish hundreds of {categoryName.toLowerCase()} tenders
              through the state e-procurement portal, CPPP, and Government e-Marketplace (GeM).
            </p>
            <p className="mb-4">
              For businesses specialising in {categoryName.toLowerCase()}, staying updated on the
              latest tender opportunities in {stateName} is crucial. Key issuing organisations
              include the Public Works Department, Municipal Corporations, and various state-level
              boards and agencies. Tender values range from a few lakhs to several hundred crores,
              catering to businesses of all sizes.
            </p>
            <p>
              TenderBazaar helps you track all {categoryName.toLowerCase()} tenders in {stateName}
              from a single dashboard. Set up smart alerts, use AI-powered eligibility checks to
              instantly know if you qualify, and never miss a deadline with our automated
              notification system.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-10 bg-card rounded-2xl p-8 md:p-12 text-center border border-border">
          <h2 className="text-2xl font-bold text-foreground mb-3">
            Get {categoryName} Tender Alerts for {stateName}
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Receive daily alerts for new {categoryName.toLowerCase()} tenders in {stateName}.
            AI-powered matching to find the right opportunities for your business.
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
