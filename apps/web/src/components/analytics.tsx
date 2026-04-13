'use client';

import Script from 'next/script';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export function Analytics() {
  if (!GA_ID || process.env.NODE_ENV !== 'production') return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { page_path: window.location.pathname });`}
      </Script>
    </>
  );
}

// Plausible Analytics (alternative)
// export function PlausibleAnalytics() {
//   if (process.env.NODE_ENV !== 'production') return null;
//   return (
//     <Script
//       defer
//       data-domain="tenderbazaar.com"
//       src="https://plausible.io/js/script.js"
//       strategy="afterInteractive"
//     />
//   );
// }

export function trackEvent(action: string, params?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', action, params);
  }
}
