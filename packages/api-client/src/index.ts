/**
 * @mentor/api-client — type-safe client (skeleton).
 *
 * Plan (§8): apps/api produces the `/v1` OpenAPI spec → this package is
 * codegen'd via orval → shared by web + mobile + panel. The `generate` script
 * activates once the spec is ready. For now, only the base-path contract.
 */
export const API_BASE_PATH = "/v1" as const;

export interface ApiClientConfig {
  baseUrl: string;
  getAccessToken?: () => string | null;
}
