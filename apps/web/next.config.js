// `output: 'standalone'` is what apps/web/Dockerfile deploys: it copies
// .next/standalone and runs `node apps/web/server.js`. The Docker builder is
// node:20-alpine, so it keeps standalone output unchanged.
//
// On Windows the standalone tracer has to reproduce the pnpm node_modules
// layout, which it does with symlinks. Creating a symlink there needs
// SeCreateSymbolicLinkPrivilege, granted to a normal account only when
// Developer Mode is on, so the build dies with
// "EPERM: operation not permitted, symlink". Standalone output is not used by
// the local workflow (`next dev` / `next start` read .next directly), so it is
// off on Windows by default. Set NEXT_STANDALONE=1 to force it back on, e.g.
// from an elevated shell or with Developer Mode enabled.
const useStandalone = process.env.NEXT_STANDALONE === '1' || process.platform !== 'win32';

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(useStandalone ? { output: 'standalone' } : {}),
  transpilePackages: ['@tenderbazaar/shared'],
  poweredByHeader: false,
  compress: true,
  images: {
    domains: ['tenderbazaar.com'],
    // AVIF output is deliberately off. GHSA-2xp9-vwfh-vxw4 (critical, CVSS 9.5)
    // is an unauthenticated RCE reached by optimising AVIF files, via libheif
    // inside sharp. It affects next >=10.0.0 <15.5.24, so 14.2.35 (pinned here)
    // IS affected and there is no 14.x patch — the advisory lists fixes only in
    // 15.5.24 and 16.3.3. Upstream's own mitigation was to disable AVIF
    // optimisation, which is what removing it from `formats` does: the
    // optimiser never emits AVIF, so the vulnerable path is not exercised.
    // WebP still covers every browser this app targets.
    //
    // This is a mitigation, not the fix. Moving to a patched line is a Next 15
    // major upgrade and is tracked separately; see docs/release-gating.md.
    formats: ['image/webp'],
  },
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
      ],
    },
  ],
};

module.exports = nextConfig;
