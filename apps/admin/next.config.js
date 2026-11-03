const { PHASE_PRODUCTION_BUILD } = require('next/constants');
const { validateApiUrlForBuild } = require('./api-url.config');

// `output: 'standalone'` is what apps/admin/Dockerfile deploys: it copies
// .next/standalone and runs `node apps/admin/server.js`. The Docker builder is
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
//
// This mirrors apps/web/next.config.js, which already had this gate; admin was
// missed, so `pnpm build` failed at the repo level on Windows.
const useStandalone = process.env.NEXT_STANDALONE === '1' || process.platform !== 'win32';

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(useStandalone ? { output: 'standalone' } : {}),
  transpilePackages: ['@tenderbazaar/shared'],
};
module.exports = (phase) => {
  // Production builds must know the public API URL; see api-url.config.js.
  if (phase === PHASE_PRODUCTION_BUILD) {
    const { problem } = validateApiUrlForBuild(process.env);
    if (problem) throw new Error(`[config] ${problem}`);
  }
  return nextConfig;
};
