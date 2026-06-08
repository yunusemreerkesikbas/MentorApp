import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile workspace packages (§8 monorepo).
  transpilePackages: ["@mentor/ui"],
};

export default nextConfig;
