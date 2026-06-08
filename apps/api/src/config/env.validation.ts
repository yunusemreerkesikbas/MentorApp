import { z } from "zod";

/**
 * Environment variable schema (§8/§10).
 *
 * SKELETON RULE: so the app can boot without secrets, external service keys are
 * `optional`. In a real implementation the relevant module enforces its own key at
 * runtime (fail-fast inside the adapter). Descriptions of all keys: .env.example +
 * docs/integrations.md.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  APP_URL: z.string().url().default("http://localhost:3000"),

  // DB — Neon (§8)
  DATABASE_URL: z.string().url().optional(),

  // Auth — own JWT (§8)
  JWT_ACCESS_SECRET: z.string().min(16).optional(),
  JWT_REFRESH_SECRET: z.string().min(16).optional(),

  // AI (§8): text = OpenAI, vision = Gemini
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),

  // Payments — iyzico (§7)
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

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Invalid environment variables:\n${parsed.error.toString()}`);
  }
  return parsed.data;
}
