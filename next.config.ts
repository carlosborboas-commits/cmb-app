import type { NextConfig } from "next";

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'docs.concoursmondial.com',
      },
      {
        protocol: 'https',
        hostname: 'results.concoursmondial.com',
      },
    ],
  },
};

export default nextConfig;