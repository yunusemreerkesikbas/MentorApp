import { createHash } from "node:crypto";
import { Test } from "@nestjs/testing";
import { UserRole } from "@mentor/types";
import { ConfigRegistryService } from "../../src/common/config/config-registry.service";
import { AuthService } from "../../src/modules/identity/application/auth.service";
import { UsersService } from "../../src/modules/identity/application/users.service";
import { hashToken } from "../../src/modules/identity/application/token.service";
import { EmailTokenRepository } from "../../src/modules/identity/infrastructure/email-token.repository";
import { EMAIL_PORT } from "../../src/shared/ports/email.port";
import { createTestApp } from "../app-harness";
import { assertLocalTestDatabase } from "../database-target";
import migrateTestDatabase from "../global-setup";

/** Opt-in, loopback-only API fixture. Never points at a developer or production database. */
async function main() {
  const target = process.env.TEST_DATABASE_URL;
  if (process.env.QA_NOTEBOOK_LIVE !== "1" || !target)
    throw new Error("Explicit notebook QA target required");
  assertLocalTestDatabase(target);
  if (new URL(target).pathname !== "/mentor_notebook_live_20261031_test") {
    throw new Error("Notebook QA requires its dedicated disposable database");
  }
  Object.assign(process.env, {
    DATABASE_URL: target,
    NODE_ENV: "test",
    APP_ENV: "development",
    APP_URL: "http://localhost:3510",
    CORS_ORIGINS: "http://localhost:3510",
    AI_PROVIDER: "fake",
    VISION_PROVIDER: "fake",
    STORAGE_PROVIDER: "fake",
    STORAGE_ACCESS_MODE: "direct",
    ADS_LOCAL_TEST_ENABLED: "false",
    JWT_ACCESS_SECRET: "notebook-live-qa-access-secret-00000000000",
    AUTH_RATE_LIMIT_SECRET: "notebook-live-qa-auth-rate-secret-00000000",
    MEDIA_READ_SECRET: "notebook-live-qa-media-secret-000000000000",
    PAYMENTS_WEBHOOK_SECRET: "notebook-live-qa-webhook-secret",
  });
  for (const key of [
    "EDGE_ORIGIN_SECRET",
    "TURNSTILE_SECRET_KEY",
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "RESEND_API_KEY",
  ]) {
    delete process.env[key];
  }
  await migrateTestDatabase();
  const { AppModule } = await import("../../src/app.module");
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EMAIL_PORT)
    .useValue({ sendTransactional: async () => undefined })
    .compile();
  const app = createTestApp(moduleRef, { authRateLimits: false });
  app.enableCors({ origin: "http://localhost:3510", credentials: true });
  await app.init();
  const auth = moduleRef.get(AuthService);
  const users = moduleRef.get(UsersService);
  const tokens = moduleRef.get(EmailTokenRepository);
  const config = moduleRef.get(ConfigRegistryService);
  const password = "NotebookQa!2026";
  const run = process.env.QA_NOTEBOOK_RUN_ID!;
  const signup = (email: string, displayName: string) =>
    auth.signup({
      email,
      password,
      displayName,
      username: `n_${createHash("sha256").update(email).digest("hex").slice(0, 16)}`,
      kvkkAccepted: true,
      termsAccepted: true,
      ageEligibilityConfirmed: true,
    });
  const operator = await signup(
    `qa-notebook-operator-${run}@example.test`,
    "QA notebook operator",
  );
  await users.addRole(operator.user.id, UserRole.SUPER_ADMIN);
  await config.set(operator.user.id, "economy.enabled", true);
  await config.set(operator.user.id, "economy.coin.notebook_slot_cost", 20);
  await config.set(operator.user.id, "economy.notebook_slots.max_per_user", 2);
  // No background AI or paid storage is needed for any of these browser scenarios.
  await config.set(operator.user.id, "ai.enabled", false);
  for (const project of ["mobile", "desktop"]) {
    for (const scenario of ["purchase", "switches"]) {
      const email = `qa-notebook-${project}-${scenario}-${run}@example.test`;
      const result = await signup(email, `QA notebook ${project}`);
      const raw = createHash("sha256").update(email).digest("hex");
      // A known one-time token belongs only to this disposable identity. Verification still runs
      // through the real endpoint/events; no XP, Coin, quest progress or notebook is seeded.
      await tokens.create(
        {
          userId: result.user.id,
          type: "VERIFY_EMAIL",
          tokenHash: hashToken(raw),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
        email,
        async () => undefined,
      );
    }
  }
  await app.listen(3501, "localhost");
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void app.close().finally(() => process.exit(0));
    });
  }
  console.log(
    "Notebook QA API ready at http://localhost:3501/v1 (isolated test database)",
  );
}

void main().catch((error: unknown) => {
  console.error(
    "Notebook QA fixture failed",
    error instanceof Error ? error.name : "Unknown error",
  );
  process.exit(1);
});
