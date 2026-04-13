const BASE_URL = 'https://tenderbazaar.com';

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'TenderBazaar',
    url: BASE_URL,
    description:
      'AI-powered tender aggregation platform. Find 50,000+ government tenders from GeM, CPPP, and 28 state portals.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/tenders?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'TenderBazaar',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    description:
      'India\'s smartest tender aggregation platform powered by AI.',
    sameAs: [
      'https://twitter.com/tenderbazaar',
      'https://linkedin.com/company/tenderbazaar',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'support@tenderbazaar.com',
      availableLanguage: ['English', 'Hindi'],
    },
  };
}

export function tenderListingSchema(
  tenders: Array<{
    title: string;
    url: string;
    description?: string;
    organization?: string;
    deadline?: string;
    value?: number;
  }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: tenders.map((tender, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'GovernmentService',
        name: tender.title,
        url: tender.url,
        description: tender.description,
        provider: tender.organization
          ? {
              '@type': 'GovernmentOrganization',
              name: tender.organization,
            }
          : undefined,
        ...(tender.deadline
          ? {
              offers: {
                '@type': 'Offer',
                validThrough: tender.deadline,
                ...(tender.value != null
                  ? {
                      price: tender.value,
                      priceCurrency: 'INR',
                    }
                  : {}),
              },
            }
          : {}),
      },
    })),
  };
}

export function blogPostSchema(post: {
  title: string;
  slug: string;
  description: string;
  author?: string;
  publishedAt: string;
  updatedAt?: string;
  image?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    url: `${BASE_URL}/blog/${post.slug}`,
    image: post.image || `${BASE_URL}/og-image.png`,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: {
      '@type': 'Organization',
      name: post.author || 'TenderBazaar',
      url: BASE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'TenderBazaar',
      url: BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/logo.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${BASE_URL}/blog/${post.slug}`,
    },
  };
}

export function faqSchema(
  faqs: Array<{ question: string; answer: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function breadcrumbSchema(
  items: Array<{ name: string; url: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`,
    })),
  };
}
