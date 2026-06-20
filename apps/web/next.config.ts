import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // next-intl 3.x's plugin writes the Turbopack config alias to the deprecated
  // `experimental.turbo` key, which Next 16 ignores (it reads `turbopack`) — so the
  // alias is dropped and static export fails with "Couldn't find next-intl config
  // file". We set it on the correct key here. ponytail: drop this when next-intl v4.
  turbopack: {
    resolveAlias: { "next-intl/config": "./src/i18n/request.ts" },
  },
  // Transpile workspace packages (§8 monorepo).
  transpilePackages: [
    "@mentor/ui",
    "@mentor/api-client",
    "@mentor/types",
    "@mentor/validation",
  ],
};

export default withNextIntl(nextConfig);
