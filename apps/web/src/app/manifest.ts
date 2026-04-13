import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TenderBazaar',
    short_name: 'TenderBazaar',
    description: 'India\'s Smartest Tender Platform',
    start_url: '/',
    display: 'standalone',
    background_color: '#1B2845',
    theme_color: '#FF6B35',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
