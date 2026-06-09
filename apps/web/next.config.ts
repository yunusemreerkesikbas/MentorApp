import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile workspace packages (§8 monorepo).
  transpilePackages: ["@mentor/ui", "@mentor/api-client", "@mentor/types", "@mentor/validation"],
};

export default nextConfig;
