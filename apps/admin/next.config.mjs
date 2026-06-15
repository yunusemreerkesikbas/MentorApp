/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // The Duralux demo pages (off-menu reference, JS) don't satisfy Next's generated route
    // type checks. Type safety for OUR code is enforced by `pnpm typecheck`
    // (tsconfig.typecheck.json scopes tsc to .ts/.tsx only). See apps/admin/AGENTS.md.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
