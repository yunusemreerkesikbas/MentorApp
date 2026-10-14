import type { Env } from "./env.validation";

/** Local-only preview; a public deployment must never bypass rollout/country gates. */
export function isLocalDisplayTestAllowed(
  env: Pick<Env, "NODE_ENV" | "APP_ENV" | "APP_URL" | "ADS_LOCAL_TEST_ENABLED">,
): boolean {
  if (env.ADS_LOCAL_TEST_ENABLED !== "true" || env.NODE_ENV !== "development") return false;
  if (env.APP_ENV && env.APP_ENV !== "development") return false;
  const url = new URL(env.APP_URL);
  return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}
