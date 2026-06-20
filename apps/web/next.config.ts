import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Transpile workspace packages (§8 monorepo).
  transpilePackages: [
    "@mentor/ui",
    "@mentor/api-client",
    "@mentor/types",
    "@mentor/validation",
  ],
};

export default withNextIntl(nextConfig);
