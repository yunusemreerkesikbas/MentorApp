import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

/** Narrow runner for web unit specs; web intentionally does not duplicate the Vitest dependency. */
export default defineConfig({
  root: "../..",
  test: {
    environment: "node",
    include: ["apps/web/src/**/*.spec.ts"],
  },
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: "typescript" },
        target: "es2022",
      },
    }),
  ],
});
