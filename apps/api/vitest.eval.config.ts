import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

/** Opt-in real-model prompt evals; isolated from default tests and provider contract checks. */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/eval/**/*.eval.ts"],
    fileParallelism: false,
    hookTimeout: 10_000,
    testTimeout: 360_000,
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