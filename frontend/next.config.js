/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // Static export emits trip/index.html (not trip.html) so Firebase Hosting
  // can serve /trip/?id=... without cleanUrls rewrites.
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'https://hackruf24.onrender.com'
  }
};

module.exports = nextConfig;