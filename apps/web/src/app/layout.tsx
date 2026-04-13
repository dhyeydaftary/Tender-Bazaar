import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { Toaster } from 'sonner';
import './globals.css';

/* ── Fonts ──────────────────────────────────────────────────────── */

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600'],
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
  weight: ['400', '500'],
});

/* ── Metadata ───────────────────────────────────────────────────── */

export const metadata: Metadata = {
  metadataBase: new URL('https://tenderbazaar.com'),
  title: {
    default: "TenderBazaar — India's Smartest Tender Platform",
    template: '%s | TenderBazaar',
  },
  description:
    'AI-powered tender aggregation platform. Find 50,000+ government tenders from GeM, CPPP, and 28 state portals. Smart alerts, eligibility checking, and document management.',
  keywords: [
    'government tenders',
    'tender India',
    'GeM tenders',
    'CPPP',
    'e-procurement',
    'tender management',
    'government contracts India',
    'tender aggregator',
    'AI eligibility check',
  ],
  authors: [{ name: 'TenderBazaar' }],
  creator: 'TenderBazaar',
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://tenderbazaar.com',
    siteName: 'TenderBazaar',
    title: "TenderBazaar — India's Smartest Tender Platform",
    description: 'AI-powered tender aggregation. 50,000+ tenders from 28 states.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'TenderBazaar' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "TenderBazaar — India's Smartest Tender Platform",
    description: 'AI-powered tender aggregation. 50,000+ tenders from 28 states.',
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
};

/* ── Root Layout ────────────────────────────────────────────────── */

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${jakarta.variable} ${inter.variable} ${jetbrains.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster
            position="top-right"
            richColors
            toastOptions={{
              style: {
                fontFamily: 'var(--font-jakarta)',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
