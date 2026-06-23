import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/forum-public";

/** Allow public pages; keep crawlers out of the authed app surface (locale-prefixed). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/*/panel",
        "/*/plan",
        "/*/seans",
        "/*/koc",
        "/*/analiz",
        "/*/profil",
        "/*/abonelik",
        "/*/hedef",
        "/*/topluluk",
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
