import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { webSecurityHeaders } from "./src/lib/security-headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: webSecurityHeaders(process.env.NODE_ENV === "production") }];
  },
  turbopack: {
    resolveAlias: {
      // Workspace package `dist/` imports these; Turbopack resolves from packages/*/
      // and misses pnpm junctions. Pin to the web app install.
      "lucide-react": "./node_modules/lucide-react",
      zod: "./node_modules/zod",
    },
  },
  // Bilgi → Blog (2026-09-23). Old links, crawled URLs and the coach's "/bilgi" text keep working.
  async redirects() {
    return [
      { source: "/bilgi", destination: "/blog", permanent: true },
      { source: "/bilgi/:slug", destination: "/blog/:slug", permanent: true },
      { source: "/en/knowledge", destination: "/en/blog", permanent: true },
      { source: "/en/knowledge/:slug", destination: "/en/blog/:slug", permanent: true },
      // Gündem → Akış "Popüler" (Topluluk Tur 2, 2026-10-08): tag trends were nearly always empty.
      { source: "/topluluk/gundem", destination: "/topluluk/akis?sort=top", permanent: true },
      { source: "/en/community/trends", destination: "/en/community/feed?sort=top", permanent: true },
      // Emek panosu → Haftalık lig (Topluluk Tur 2, 2026-10-08): the address follows the new name.
      { source: "/topluluk/siralama", destination: "/topluluk/lig", permanent: true },
      { source: "/en/community/leaderboard", destination: "/en/community/league", permanent: true },
    ];
  },
  // Tree-shake lucide named imports (Next + lucide guidance).
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },  // Transpile workspace packages (§8 monorepo).
  transpilePackages: [
    "@mentor/ui",
    "@mentor/api-client",
    "@mentor/types",
    "@mentor/validation",
  ],
};

export default withNextIntl(nextConfig);
