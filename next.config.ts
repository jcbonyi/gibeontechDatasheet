import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    middlewareClientMaxBodySize: '25mb',
  },
};

export default nextConfig;
