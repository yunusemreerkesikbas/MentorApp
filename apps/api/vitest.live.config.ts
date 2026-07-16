import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

/** Opt-in real-provider tests: no DB global setup and never part of the default test command. */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/live/**/*.spec.ts"],
    fileParallelism: false,
    hookTimeout: 10_000,
    testTimeout: 60_000,
  },
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: "typescript", decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: "es2022",
        keepClassNames: true,
      },
    }),
  ],
});
