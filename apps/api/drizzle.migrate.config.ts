import { defineConfig } from "drizzle-kit";
import config from "./drizzle.config";
import { getMigrationDatabaseUrl } from "./src/database/migration-database-url";

export default defineConfig({
  ...config,
  dbCredentials: { url: getMigrationDatabaseUrl(process.env) },
});
