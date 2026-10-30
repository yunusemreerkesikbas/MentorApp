/** Optional isolated API origin; CI keeps the standard localhost:3001 endpoint. */
export const browserApiUrl = process.env.QA_STAGE2_API_URL?.trim() || "http://localhost:3001/v1";
export const browserApiOrigin = new URL(browserApiUrl).origin;
