import type { MetadataRoute } from "next";
import { getPathname } from "@/i18n/navigation";
import { siteUrl } from "@/lib/forum-public";

const PRIVATE_PATHS = [
  "/dashboard",
  "/plan",
  "/study-session",
  "/coach",
  "/analysis",
  "/profile",
  "/subscription",
  "/vision-board",
  "/community",
] as const;

/** Allow public pages; keep crawlers out of the localized authenticated app surface. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: (["tr", "en"] as const).flatMap((locale) =>
        PRIVATE_PATHS.map((href) => getPathname({ locale, href })),
      ),
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
