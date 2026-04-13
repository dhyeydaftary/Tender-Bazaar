/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@tenderbazaar/shared'],
};
module.exports = nextConfig;
