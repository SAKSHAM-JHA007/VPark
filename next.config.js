/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/parkora',
        destination: '/',
        permanent: true,
      },
      {
        source: '/parkora/:path*',
        destination: '/:path*',
        permanent: true,
      },
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
      {
        source: '/find-parking',
        destination: '/driver/home',
        permanent: true,
      },
      {
        source: '/rent-your-space',
        destination: '/owner/dashboard',
        permanent: true,
      },
      {
        source: '/rent-space',
        destination: '/owner/dashboard',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
