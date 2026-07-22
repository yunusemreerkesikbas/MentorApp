import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Drizzle-kit config (§8) — Neon Postgres + pgvector.
 * As schema files grow, `schema` can become a glob.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/database/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
