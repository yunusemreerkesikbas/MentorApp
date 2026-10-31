import { isIP } from "node:net";
import type { z } from "zod";

interface StorageAccessEnv {
  NODE_ENV: string;
  APP_ENV?: string;
  STORAGE_ACCESS_MODE: "direct" | "bounded";
  STORAGE_PROVIDER: "fake" | "r2";
  MEDIA_READ_SECRET?: string;
  JWT_ACCESS_SECRET: string;
  AUTH_RATE_LIMIT_SECRET: string;
  EDGE_ORIGIN_SECRET?: string;
  CRON_SECRET?: string;
  R2_ACCOUNT_ID?: string;
  R2_PUBLIC_BUCKET?: string;
  R2_PRIVATE_BUCKET?: string;
  R2_PUBLIC_BASE_URL?: string;
  R2_JURISDICTION: "auto" | "eu";
}

export function validateStorageAccess(env: StorageAccessEnv, ctx: z.RefinementCtx): void {
  if (env.STORAGE_ACCESS_MODE !== "bounded") return;
  const issue = (field: keyof StorageAccessEnv, message: string) => ctx.addIssue({ code: "custom", path: [field], message });
  if (!env.MEDIA_READ_SECRET || env.MEDIA_READ_SECRET.trim().length < 32) {
    issue("MEDIA_READ_SECRET", "Bounded media requires an independent signing secret of at least 32 characters.");
  } else if ([env.JWT_ACCESS_SECRET, env.AUTH_RATE_LIMIT_SECRET, env.EDGE_ORIGIN_SECRET, env.CRON_SECRET].includes(env.MEDIA_READ_SECRET)) {
    issue("MEDIA_READ_SECRET", "The media signing secret must be independent of auth, edge and cron secrets.");
  }
  for (const field of ["R2_ACCOUNT_ID", "R2_PUBLIC_BUCKET", "R2_PRIVATE_BUCKET"] as const) {
    if (!env[field]?.trim() || env[field] !== env[field]?.trim()) issue(field, "Bounded storage requires an explicit account and bucket scope.");
  }
  if (env.STORAGE_PROVIDER === "r2" && !/^[a-f0-9]{32}$/.test(env.R2_ACCOUNT_ID ?? "")) {
    issue("R2_ACCOUNT_ID", "Bounded R2 storage requires a valid account identifier.");
  }
  if (env.R2_PUBLIC_BUCKET === env.R2_PRIVATE_BUCKET) issue("R2_PRIVATE_BUCKET", "Bounded storage requires distinct public and private buckets.");
  if (env.R2_JURISDICTION !== "eu") issue("R2_JURISDICTION", "The bounded trial storage scope requires EU jurisdiction.");
  let valid = false;
  try {
    const url = new URL(env.R2_PUBLIC_BASE_URL ?? "");
    const host = url.hostname.toLowerCase();
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(host);
    const publicHttps = url.protocol === "https:" && host.includes(".") && !host.endsWith(".localhost") &&
      !host.endsWith(".local") && !loopback && !isIP(host.replace(/^\[|\]$/g, ""));
    const localTest = env.NODE_ENV !== "production" && env.APP_ENV !== "production" && loopback && url.protocol === "http:";
    valid = (publicHttps || localTest) && !url.username && !url.password && !url.search && !url.hash &&
      url.pathname === "/v1/storage/media/public";
  } catch { /* Invalid input is reported below without disclosing the URL. */ }
  if (!valid) issue("R2_PUBLIC_BASE_URL", "Bounded storage requires an explicit HTTPS API gateway base ending in /v1/storage/media/public; non-production loopback HTTP is allowed for tests.");
}
