import { AdPlacementId } from "@mentor/types";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { DeferredContextualAdSlot } from "@/components/ads/deferred-contextual-ad-slot";
import { showsFeatured, type BlogQuery } from "@/lib/blog-url";
import { loadBlogPosts } from "./blog-posts";

/** One DOM slot: after the calendar on desktop and before it below the article list on mobile. */
export async function BlogIndexAd({ query }: { query: BlogQuery }) {
  const { featured, list } = await loadBlogPosts(query.family, query.category, query.page);
  if (!list || (list.items.length === 0 && !showsFeatured(featured, query))) return null;
  const t = await getTranslations("ads");
  return (
    <NextIntlClientProvider messages={{ ads: { label: t("label") } }}>
      <DeferredContextualAdSlot
        placementId={AdPlacementId.KNOWLEDGE_INDEX}
        blogList={{ family: query.family, category: query.category ?? undefined, page: query.page }}
        className="order-first xl:order-last"
      />
    </NextIntlClientProvider>
  );
}
