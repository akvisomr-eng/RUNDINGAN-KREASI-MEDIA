import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // This app is built from its own Vercel/CI root inside the monorepo.
  turbopack: { root: process.cwd() },
};

export default nextConfig;
