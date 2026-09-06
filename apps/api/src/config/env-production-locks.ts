import { isIP } from "node:net";
import type { z } from "zod";

function publicHttpsOrigin(value: string): URL | undefined {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      !host.includes(".") || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      isIP(host.replace(/^\[|\]$/g, "")) !== 0) return undefined;
    return url;
  } catch { return undefined; }
}

interface ProductionSecurityEnv {
  NODE_ENV: string;
  APP_URL: string;
  CORS_ORIGINS?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_EXPECTED_HOSTNAME?: string;
  CLOUDFLARE_ACCESS_TEAM_DOMAIN?: string;
  CLOUDFLARE_ACCESS_AUD?: string;
}

export function validateProductionSecurity(env: ProductionSecurityEnv, ctx: z.RefinementCtx): void {
  if (env.NODE_ENV !== "production") return;
  const issue = (path: keyof ProductionSecurityEnv, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  const appUrl = publicHttpsOrigin(env.APP_URL);
  if (!appUrl) issue("APP_URL", "APP_URL must be an HTTPS origin with a public hostname in production.");
  const origins = env.CORS_ORIGINS?.split(",").map((origin) => origin.trim());
  if (!origins?.length || origins.some((origin) => publicHttpsOrigin(origin)?.origin !== origin)) {
    issue("CORS_ORIGINS", "CORS_ORIGINS must explicitly list HTTPS origins with public hostnames in production.");
  }
  if (!env.TURNSTILE_SECRET_KEY?.trim()) issue("TURNSTILE_SECRET_KEY", "TURNSTILE_SECRET_KEY is required in production.");
  if (!env.TURNSTILE_EXPECTED_HOSTNAME || env.TURNSTILE_EXPECTED_HOSTNAME !== appUrl?.hostname) {
    issue("TURNSTILE_EXPECTED_HOSTNAME", "TURNSTILE_EXPECTED_HOSTNAME must match the APP_URL hostname in production.");
  }
  let accessDomain: URL | undefined;
  try {
    accessDomain = env.CLOUDFLARE_ACCESS_TEAM_DOMAIN
      ? new URL(env.CLOUDFLARE_ACCESS_TEAM_DOMAIN)
      : undefined;
  } catch {
    accessDomain = undefined;
  }
  if (
    !accessDomain ||
    accessDomain.protocol !== "https:" ||
    !accessDomain.hostname.toLowerCase().endsWith(".cloudflareaccess.com") ||
    accessDomain.pathname !== "/" ||
    accessDomain.search ||
    accessDomain.hash ||
    accessDomain.username ||
    accessDomain.password
  ) {
    issue(
      "CLOUDFLARE_ACCESS_TEAM_DOMAIN",
      "CLOUDFLARE_ACCESS_TEAM_DOMAIN must be the HTTPS Cloudflare Access team origin in production.",
    );
  }
  if (!env.CLOUDFLARE_ACCESS_AUD?.trim()) {
    issue("CLOUDFLARE_ACCESS_AUD", "CLOUDFLARE_ACCESS_AUD is required in production.");
  }
}
