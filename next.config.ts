import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/proxy/gus/:path*",
        destination: "https://bdl.stat.gov.pl/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
