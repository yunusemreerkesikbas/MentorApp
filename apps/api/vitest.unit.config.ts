import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

/** Fast unit-test runner. Integration/e2e suites continue to use vitest.config.ts. */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      AI_PROVIDER: "fake",
      VISION_PROVIDER: "fake",
      JWT_ACCESS_SECRET: "test-secret-test-secret-test-secret!!",
      PAYMENTS_WEBHOOK_SECRET: "test-payments-webhook-secret",
    },
    include: ["src/**/*.spec.ts"],
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
