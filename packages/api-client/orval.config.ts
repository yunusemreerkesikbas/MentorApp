import { defineConfig } from "orval";

/**
 * Codegen: apps/api OpenAPI spec → typed client (§8).
 * Regenerate: `pnpm --filter @mentor/api openapi:export && pnpm --filter @mentor/api-client generate`.
 */
export default defineConfig({
  mentor: {
    input: "./openapi.json",
    output: {
      target: "./src/generated/api.ts",
      client: "fetch",
      override: {
        mutator: { path: "./src/http.ts", name: "http" },
      },
    },
  },
});
