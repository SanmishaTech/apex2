import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // ADD THIS SECTION:
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ["localhost"],
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "localhost",
      },
    ],
    unoptimized: process.env.NODE_ENV === "development",
  },
  eslint: {
    // Skip ESLint during production builds to avoid failing builds on lint errors.
    // Lint still runs in dev and via `next lint`.
    ignoreDuringBuilds: true,
  },
  /* config options here */
};

export default nextConfig;
