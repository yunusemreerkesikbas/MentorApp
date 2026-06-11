import { z } from "zod";

/**
 * Environment variable schema (§8/§10).
 *
 * `DATABASE_URL` is REQUIRED (fail-fast — the app cannot function without it). Other external
 * service keys stay optional until the relevant module is built; each adapter enforces its own
 * at runtime. All keys: .env.example + docs/integrations.md.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  APP_URL: z.string().url().default("http://localhost:3000"),

  // Comma-separated allowed CORS origins (web/admin). Falls back to dev defaults if unset.
  CORS_ORIGINS: z.string().optional(),

  // DB — Postgres (local docker / Neon). Required: the app cannot function without it (fail-fast).
  DATABASE_URL: z.string().url(),

  // Auth — own JWT (§8). Required since W0 identity (fail-fast).
  JWT_ACCESS_SECRET: z.string().min(32),
  /** Access token TTL in seconds (short-lived; client silently refreshes). */
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  /** Refresh token TTL in seconds (opaque token, httpOnly cookie). */
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2_592_000),

  // AI (§8): text = OpenAI, vision = Gemini
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),

  // Payments (§7) — provider behind PaymentsPort. `fake` is the dev/test default;
  // the production lock below makes shipping with fake impossible.
  PAYMENTS_PROVIDER: z.enum(["fake", "iyzico"]).default("fake"),
  /** HMAC secret for webhook signature verification (fake provider + dev simulation). */
  PAYMENTS_WEBHOOK_SECRET: z.string().min(16),
  IYZICO_API_KEY: z.string().optional(),
  IYZICO_SECRET_KEY: z.string().optional(),
  IYZICO_BASE_URL: z.string().url().default("https://sandbox-api.iyzipay.com"),

  // Cloudflare (§8): R2 + Turnstile
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),

  // Email — Postmark (§8)
  POSTMARK_TOKEN: z.string().optional(),

  // Error monitoring — Sentry (§8)
  SENTRY_DSN: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Cross-field locks that single-field rules can't express. */
const envSchemaWithLocks = envSchema.superRefine((env, ctx) => {
  // Production safety lock: the fake payments provider must never reach production.
  if (env.NODE_ENV === "production" && env.PAYMENTS_PROVIDER === "fake") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["PAYMENTS_PROVIDER"],
      message: "PAYMENTS_PROVIDER=fake is forbidden in production — configure iyzico.",
    });
  }
  if (env.PAYMENTS_PROVIDER === "iyzico" && (!env.IYZICO_API_KEY || !env.IYZICO_SECRET_KEY)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["IYZICO_API_KEY"],
      message: "IYZICO_API_KEY/IYZICO_SECRET_KEY are required when PAYMENTS_PROVIDER=iyzico.",
    });
  }
});

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchemaWithLocks.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Invalid environment variables:\n${parsed.error.toString()}`);
  }
  return parsed.data;
}
