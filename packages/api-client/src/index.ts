/**
 * @mentor/api-client — typed client for the Mentor API (/v1).
 *
 * - `configureApiClient` + `http` (fetch mutator: cookie credentials + bearer + ApiError).
 * - `./generated/api` — orval output from the OpenAPI spec. Regenerate:
 *   `pnpm --filter @mentor/api openapi:export && pnpm --filter @mentor/api-client generate`.
 */
export * from "./http.js";
export * from "./generated/api.js";

export const API_BASE_PATH = "/v1" as const;
