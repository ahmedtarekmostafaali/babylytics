/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Supabase storage public-signed URLs use the project host; tighten in prod.
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: '10mb' }, // for file uploads
  },
};

module.exports = nextConfig;
