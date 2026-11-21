import { Image, Linking, Pressable, StyleSheet, View } from "react-native";
import { AltArrowRightIcon } from "@solar-icons/react-native/linear/alt-arrow-right";
import { ArrowRightUpIcon } from "@solar-icons/react-native/linear/arrow-right-up";
import { ShieldCheckIcon } from "@solar-icons/react-native/linear/shield-check";
import type {
  ExamCalendarDto,
  ExamType,
  InfoArticleDto,
  InfoArticleSummaryDto,
} from "@mentor/types";
import { getCatalog } from "../../i18n/index.js";
import { art } from "../../lib/art.js";
import { formatDisplayDate } from "../../lib/display-date.js";
import {
  estimateReadingMinutes,
  isSafeHttpUrl,
  splitArticleProvenance,
  type ArticleCategory,
} from "../../lib/knowledge-view.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { PanelCard } from "../panel/primitives.js";
import { AppText, Button } from "../ui/index.js";
import { ArticleCover } from "./article-cover.js";
import { RelatedPostsCard } from "./article-cards.js";
import { ArticleMarkdown } from "./article-markdown.js";
import { ExamDayCard } from "./exam-day-card.js";

export function ArticleReader({
  article,
  calendar,
  related,
  onSelectCategory,
  onSelectArticle,
  onBackToList,
  onAskPuhu,
}: {
  article: InfoArticleDto;
  calendar: ExamCalendarDto | null;
  related: InfoArticleSummaryDto[];
  onSelectCategory: (category: ArticleCategory) => void;
  onSelectArticle: (slug: string) => void;
  onBackToList: () => void;
  onAskPuhu: () => void;
}) {
  const { palette, radii } = useThemeTokens();
  const { locale } = useLocale();
  const t = useTranslations("knowledge");
  const labels: Readonly<Partial<Record<string, string>>> = getCatalog(locale).knowledgeLabels;

  const provenance = splitArticleProvenance(article.body, article.bodyFormat);
  const minutes = estimateReadingMinutes(article.body, article.bodyFormat);
  const categoryLabel = Object.hasOwn(labels, article.category)
    ? (labels[article.category] ?? t("article_category"))
    : t("article_category");
  const authorName = article.author?.name ?? t("editor_fallback");
  const publishedLabel = article.publishedAt
    ? formatDisplayDate(article.publishedAt, locale)
    : null;
  const verifiedLabel = formatDisplayDate(article.verifiedAt, locale);
  const updatedLabel = formatDisplayDate(article.updatedAt, locale);

  return (
    <View style={styles.root}>
      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <Pressable accessibilityRole="button" onPress={onBackToList} style={styles.crumbBtn}>
          <AppText style={[styles.crumbText, { color: palette.secondary }]}>
            {t("title")}
          </AppText>
        </Pressable>
        <AltArrowRightIcon size={14} color={palette.secondary} strokeWidth={1.75} />
        <Pressable
          accessibilityRole="button"
          onPress={() => onSelectCategory(article.category as ArticleCategory)}
          style={styles.crumbBtn}
        >
          <AppText style={[styles.crumbText, { color: palette.secondary }]}>
            {categoryLabel}
          </AppText>
        </Pressable>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <AppText accessibilityRole="header" style={styles.title}>
          {article.title}
        </AppText>
        <AppText variant="caption" tone="secondary" style={styles.meta}>
          {[
            authorName,
            publishedLabel,
            t("reading_time", { minutes }),
          ]
            .filter(Boolean)
            .join(" · ")}
        </AppText>
      </View>

      <ArticleCover article={article} variant="reader" />

      {/* Body */}
      <ArticleMarkdown
        body={provenance.body}
        format={article.bodyFormat}
        onOpenArticle={onSelectArticle}
      />

      {/* Consolidated Trust & Provenance Row */}
      <View style={[styles.trustRow, { borderColor: palette.playLine }]}>
        <ShieldCheckIcon
          size={20}
          color={palette.success}
          strokeWidth={1.75}
          style={styles.trustIcon}
        />
        <View style={styles.trustBody}>
          <AppText style={[styles.trustTitle, { color: palette.main }]}>
            {t("trust_badge")}
          </AppText>
          <View style={styles.trustMeta}>
            {!provenance.citation ? (
              <Pressable
                accessibilityRole="link"
                disabled={!isSafeHttpUrl(article.sourceUrl)}
                onPress={() => {
                  if (isSafeHttpUrl(article.sourceUrl)) {
                    void Linking.openURL(article.sourceUrl);
                  }
                }}
                style={styles.trustSourceLink}
              >
                <AppText variant="caption" tone="secondary">
                  {t("source_label")}:{" "}
                  <AppText variant="caption" style={[styles.boldLink, { color: palette.main }]}>
                    {article.source}
                  </AppText>
                </AppText>
                {isSafeHttpUrl(article.sourceUrl) ? (
                  <ArrowRightUpIcon size={13} color={palette.main} strokeWidth={2} />
                ) : null}
              </Pressable>
            ) : null}
            <AppText variant="caption" tone="secondary">
              {t("last_verified", { date: verifiedLabel })} ·{" "}
              {t("updated_at", { date: updatedLabel })}
            </AppText>
          </View>
          {provenance.scope ? (
            <AppText variant="body" tone="secondary" style={styles.scope}>
              {provenance.scope}
            </AppText>
          ) : null}
          {provenance.citation ? (
            <View style={{ marginTop: 6 }}>
              <ArticleMarkdown
                body={provenance.citation}
                format="MARKDOWN"
                compact
                onOpenArticle={onSelectArticle}
              />
            </View>
          ) : null}
        </View>
      </View>

      {/* Puhu CTA Card */}
      <PanelCard style={styles.coachCard}>
        <View style={styles.coachTop}>
          <Image source={art.puhuEncouraging} style={styles.coachMascot} resizeMode="contain" />
          <View
            style={[
              styles.coachBubble,
              { backgroundColor: palette.playSelected, borderRadius: radii.button },
            ]}
          >
            <AppText style={[styles.coachBubbleText, { color: palette.main }]}>
              {t("coach_bubble")}
            </AppText>
          </View>
        </View>
        <Button label={t("ask_puhu_cta")} onPress={onAskPuhu} variant="primary" />
      </PanelCard>

      {/* Official Calendar Card */}
      <ExamDayCard family={article.family as ExamType} calendar={calendar} />

      {/* Related Articles */}
      <RelatedPostsCard articles={related} onSelect={onSelectArticle} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 16,
  },
  breadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  crumbBtn: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  crumbText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
  },
  meta: {
    fontWeight: "700",
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    marginTop: 4,
  },
  trustIcon: {
    marginTop: 2,
  },
  trustBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  trustTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
  },
  trustMeta: {
    gap: 2,
  },
  trustSourceLink: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  boldLink: {
    fontWeight: "800",
    textDecorationLine: "underline",
  },
  scope: {
    marginTop: 6,
  },
  coachCard: {
    gap: 14,
  },
  coachTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  coachMascot: {
    width: 64,
    height: 64,
  },
  coachBubble: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  coachBubbleText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
});
