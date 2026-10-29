interface MigrationEnvironment {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  DATABASE_MIGRATION_URL?: string;
}

/** The owner connection belongs to the migration process, not the API runtime. */
export function getMigrationDatabaseUrl(env: MigrationEnvironment): string {
  const explicitUrl = env.DATABASE_MIGRATION_URL?.trim();
  if (env.NODE_ENV === "production" && !explicitUrl) {
    throw new Error("DATABASE_MIGRATION_URL is required for production migrations.");
  }
  // Local/test tooling retains the documented single-connection developer setup.
  const connectionString = explicitUrl || env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_MIGRATION_URL or local DATABASE_URL is required for migrations.");
  }

  let parsed: URL;
  let hostname: string;
  try {
    parsed = new URL(connectionString);
    hostname = decodeURIComponent(parsed.hostname).toLowerCase().replace(/\.$/, "");
  } catch {
    throw new Error("Migration database URL must be a valid PostgreSQL connection URL.");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error("Migration database URL must be a valid PostgreSQL connection URL.");
  }
  // pg query parameters can replace the URL authority after our validation.
  if (parsed.searchParams.has("host") || parsed.searchParams.has("hostaddr")) {
    throw new Error("Migration database URL must not contain a host override.");
  }
  if (hostname.endsWith(".neon.tech") && hostname.split(".")[0]?.endsWith("-pooler")) {
    throw new Error("Migrations require a direct PostgreSQL connection, not a Neon pooler.");
  }
  return connectionString;
}
