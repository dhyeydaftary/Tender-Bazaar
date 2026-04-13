import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/settings/', '/subscription/'],
      },
    ],
    sitemap: 'https://tenderbazaar.com/sitemap.xml',
  };
}
