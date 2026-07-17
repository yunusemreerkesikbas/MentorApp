import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// SWC compiles TS + NestJS decorators (emitDecoratorMetadata) for Vitest.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Required env for module boot in e2e suites (single place — suites don't repeat these).
    env: {
      AI_PROVIDER: "fake",
      VISION_PROVIDER: "fake",
      JWT_ACCESS_SECRET: "test-secret-test-secret-test-secret!!",
      PAYMENTS_WEBHOOK_SECRET: "test-payments-webhook-secret",
    },
    include: ["src/**/*.spec.ts", "test/**/*.e2e-spec.ts", "test/eval/**/*.spec.ts"],
    // e2e files mutate process.env.DATABASE_URL → run files sequentially to avoid races.
    fileParallelism: false,
    // Migrate the test DB once before the suite (e2e needs real tables + RLS).
    globalSetup: ["./test/global-setup.ts"],
    // Nest app boot in e2e beforeAll (argon2 native + module compile) can exceed the 10s default.
    hookTimeout: 30_000,
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.spec.ts", "src/main.ts", "**/*.module.ts"],
    },
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
