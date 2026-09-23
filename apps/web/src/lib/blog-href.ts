import type { BlogQuery } from "./blog-url";

/**
 * Hub link; the defaults (KPSS, every topic, page 1) stay out of the URL. An empty `query` is left off
 * entirely, because next-intl prints it as a bare "?" (`/blog?`).
 *
 * Its own module with no runtime imports: client chrome (the public header, the app nav) needs only this,
 * and `blog-url.ts` would pull the content fetchers into their bundles.
 */
export function blogHref({ family = "KPSS", category = null, page = 1 }: Partial<BlogQuery>) {
  const query: Record<string, string> = {};
  if (family !== "KPSS") query.family = family;
  if (category) query.category = category;
  if (page > 1) query.page = String(page);
  return Object.keys(query).length > 0
    ? { pathname: "/knowledge" as const, query }
    : { pathname: "/knowledge" as const };
}
