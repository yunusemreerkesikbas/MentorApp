import { Pressable, StyleSheet, View } from "react-native";
import { AltArrowRightIcon } from "@solar-icons/react-native/linear/alt-arrow-right";
import { ShieldCheckIcon } from "@solar-icons/react-native/linear/shield-check";
import type { InfoArticleSummaryDto } from "@mentor/types";
import { getCatalog } from "../../i18n/index.js";
import { formatShortGuideDate } from "../../lib/knowledge-view.js";
import { mixHex } from "../../lib/layout.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { PanelCard } from "../panel/primitives.js";
import { AppText } from "../ui/index.js";
import { ArticleCover } from "./article-cover.js";

function PostMeta({ article }: { article: InfoArticleSummaryDto }) {
  const { palette } = useThemeTokens();
  const { locale } = useLocale();
  const t = useTranslations("knowledge");
  const labels: Readonly<Partial<Record<string, string>>> = getCatalog(locale).knowledgeLabels;
  const categoryLabel = Object.hasOwn(labels, article.category)
    ? (labels[article.category] ?? t("article_category"))
    : t("article_category");

  return (
    <View style={styles.metaRow}>
      <AppText style={[styles.metaCat, { color: palette.main }]}>{categoryLabel}</AppText>
      {article.publishedAt ? (
        <AppText style={[styles.metaDate, { color: palette.secondary }]}>
          {`· ${formatShortGuideDate(article.publishedAt, locale)}`}
        </AppText>
      ) : null}
    </View>
  );
}

export function FeaturedArticleCard({
  article,
  onPress,
}: {
  article: InfoArticleSummaryDto;
  onPress: () => void;
}) {
  const { palette } = useThemeTokens();
  const t = useTranslations("knowledge");
  const hasCover = Boolean(article.coverImage?.url);

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {({ pressed }) => (
        <PanelCard
          style={[
            styles.featuredCard,
            pressed ? { backgroundColor: mixHex(palette.main, palette.surface, 0.02) } : null,
          ]}
        >
          {hasCover ? <ArticleCover article={article} variant="featured" /> : null}
          <View style={hasCover ? styles.featuredStack : styles.featuredNoCoverRow}>
            {!hasCover ? <ArticleCover article={article} variant="featured" /> : null}
            <View style={styles.featuredBody}>
              <PostMeta article={article} />
              <AppText style={[styles.featuredTitle, { color: palette.main }]}>
                {article.title}
              </AppText>
              {article.metaDescription ? (
                <AppText numberOfLines={3} style={[styles.excerpt, { color: palette.secondary }]}>
                  {article.metaDescription}
                </AppText>
              ) : null}
              <View style={styles.featuredFooter}>
                <View style={styles.verifiedRow}>
                  <ShieldCheckIcon size={16} color={palette.success} strokeWidth={1.75} />
                  <AppText numberOfLines={1} style={[styles.verifiedText, { color: palette.secondary }]}>
                    {t("verified_source", { source: article.source })}
                  </AppText>
                </View>
                <View style={styles.readAction}>
                  <AppText numberOfLines={1} style={[styles.readLabel, { color: palette.main }]}>
                    {t("read_post")}
                  </AppText>
                  <AltArrowRightIcon size={15} color={palette.main} strokeWidth={1.75} />
                </View>
              </View>
            </View>
          </View>
        </PanelCard>
      )}
    </Pressable>
  );
}

export function ArticleRowsCard({
  articles,
  onSelect,
}: {
  articles: InfoArticleSummaryDto[];
  onSelect: (slug: string) => void;
}) {
  const { palette } = useThemeTokens();

  return (
    <PanelCard style={styles.rowsCard}>
      {articles.map((article, index) => (
        <Pressable
          key={article.slug}
          accessibilityRole="button"
          onPress={() => onSelect(article.slug)}
          style={({ pressed }) => [
            styles.row,
            index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.playLine },
            pressed ? { backgroundColor: mixHex(palette.main, palette.surface, 0.03) } : null,
          ]}
        >
          <ArticleCover article={article} variant="row" />
          <View style={styles.rowText}>
            <PostMeta article={article} />
            <AppText numberOfLines={2} style={[styles.rowTitle, { color: palette.main }]}>
              {article.title}
            </AppText>
            {article.metaDescription ? (
              <AppText numberOfLines={2} style={[styles.rowExcerpt, { color: palette.secondary }]}>
                {article.metaDescription}
              </AppText>
            ) : null}
          </View>
          <AltArrowRightIcon size={18} color={palette.secondary} strokeWidth={1.75} />
        </Pressable>
      ))}
    </PanelCard>
  );
}

export function RelatedPostsCard({
  articles,
  onSelect,
}: {
  articles: InfoArticleSummaryDto[];
  onSelect: (slug: string) => void;
}) {
  const { palette } = useThemeTokens();
  const t = useTranslations("knowledge");
  if (articles.length === 0) return null;

  return (
    <PanelCard style={styles.relatedCard}>
      <AppText accessibilityRole="header" style={styles.relatedHeading}>
        {t("related_posts")}
      </AppText>
      {articles.map((article, idx) => (
        <Pressable
          key={article.slug}
          accessibilityRole="button"
          onPress={() => onSelect(article.slug)}
          style={({ pressed }) => [
            styles.relatedRow,
            idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.playLine },
            pressed ? { backgroundColor: mixHex(palette.main, palette.surface, 0.03) } : null,
          ]}
        >
          <ArticleCover article={article} variant="related" />
          <View style={styles.rowText}>
            <AppText numberOfLines={2} style={[styles.relatedTitle, { color: palette.main }]}>
              {article.title}
            </AppText>
            <PostMeta article={article} />
          </View>
        </Pressable>
      ))}
    </PanelCard>
  );
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 5,
  },
  metaCat: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  metaDate: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  featuredCard: {
    gap: 14,
  },
  featuredStack: {
    gap: 10,
  },
  featuredNoCoverRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  featuredBody: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  featuredTitle: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "800",
  },
  excerpt: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  featuredFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 4,
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
    minWidth: 0,
  },
  verifiedText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    flexShrink: 1,
  },
  readAction: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  readLabel: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
  rowsCard: {
    paddingVertical: 4,
    paddingHorizontal: 18,
  },
  row: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  rowTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
  },
  rowExcerpt: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  relatedCard: {
    paddingBottom: 8,
    gap: 4,
  },
  relatedHeading: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  relatedRow: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  relatedTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
});
