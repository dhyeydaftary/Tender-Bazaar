import { MetadataRoute } from 'next';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const BASE_URL = 'https://tenderbazaar.com';

const STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

const UNION_TERRITORIES = [
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

const ALL_REGIONS = [...STATES, ...UNION_TERRITORIES];

const TOP_STATES = [
  'Maharashtra',
  'Uttar Pradesh',
  'Karnataka',
  'Tamil Nadu',
  'Gujarat',
  'Rajasthan',
  'Madhya Pradesh',
  'West Bengal',
  'Telangana',
  'Kerala',
];

const CATEGORIES = [
  'Construction',
  'IT & Software',
  'Medical Equipment',
  'Electrical',
  'Supply',
  'Consultancy',
];

const ORGANIZATIONS = [
  { slug: 'gem', name: 'Government e-Marketplace' },
  { slug: 'cppp', name: 'Central Public Procurement Portal' },
  { slug: 'indian-railways', name: 'Indian Railways' },
  { slug: 'nhai', name: 'National Highways Authority of India' },
  { slug: 'bhel', name: 'Bharat Heavy Electricals Limited' },
  { slug: 'ntpc', name: 'NTPC Limited' },
  { slug: 'ongc', name: 'Oil and Natural Gas Corporation' },
  { slug: 'sail', name: 'Steel Authority of India Limited' },
  { slug: 'hal', name: 'Hindustan Aeronautics Limited' },
  { slug: 'bel', name: 'Bharat Electronics Limited' },
  { slug: 'drdo', name: 'Defence Research and Development Organisation' },
  { slug: 'isro', name: 'Indian Space Research Organisation' },
  { slug: 'coal-india', name: 'Coal India Limited' },
  { slug: 'power-grid', name: 'Power Grid Corporation of India' },
  { slug: 'gail', name: 'GAIL India Limited' },
];

const BLOG_POSTS = [
  { slug: 'how-to-find-government-tenders-india', date: '2026-03-01' },
  { slug: 'gem-portal-complete-guide', date: '2026-03-05' },
  { slug: 'tender-eligibility-criteria-explained', date: '2026-03-10' },
  { slug: 'emd-bank-guarantee-guide', date: '2026-03-15' },
  { slug: 'common-tender-mistakes-to-avoid', date: '2026-03-20' },
  { slug: 'msme-benefits-government-tenders', date: '2026-03-25' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const currentDate = new Date().toISOString();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ];

  // State and UT pages
  const statePages: MetadataRoute.Sitemap = ALL_REGIONS.map((state) => ({
    url: `${BASE_URL}/browse-tenders/${toSlug(state)}`,
    lastModified: currentDate,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  // Top state + category combo pages
  const stateCategoryPages: MetadataRoute.Sitemap = TOP_STATES.flatMap(
    (state) =>
      CATEGORIES.map((category) => ({
        url: `${BASE_URL}/browse-tenders/${toSlug(state)}/${toSlug(category)}`,
        lastModified: currentDate,
        changeFrequency: 'daily' as const,
        priority: 0.7,
      }))
  );

  // Organization pages
  const orgPages: MetadataRoute.Sitemap = ORGANIZATIONS.map((org) => ({
    url: `${BASE_URL}/browse-tenders/organization/${org.slug}`,
    lastModified: currentDate,
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  // Blog post pages
  const blogPages: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: post.date,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [
    ...staticPages,
    ...statePages,
    ...stateCategoryPages,
    ...orgPages,
    ...blogPages,
  ];
}
