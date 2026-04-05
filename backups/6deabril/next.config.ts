import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/opensky/:path*',
        destination: 'https://opensky-network.org/:path*',
      },
    ];
  },
};

export default nextConfig;
