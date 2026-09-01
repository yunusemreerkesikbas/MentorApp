import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit tests for the pure logic under `src/` — layout maths, reducers, formatters. Component
 * rendering is not covered here; Playwright (`test:e2e`) owns anything that needs a DOM.
 *
 * This config exists because ten `*.spec.ts` files had accumulated with no runner: `apps/web` had
 * no `test` script, so `turbo run test` skipped the package entirely and CI never executed them.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.spec.ts"],
    server: {
      // next-intl v4 is ESM-only. Keep it in Vite's transform pipeline so package
      // subpaths such as next/navigation resolve through Next's exports map.
      deps: { inline: ["next-intl"] },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
