import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/forum-public";

/** Route metadata owns indexability so crawlers can read each page's noindex directive. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
