import { Pressable, StyleSheet, View } from "react-native";
import { AltArrowLeftIcon } from "@solar-icons/react-native/linear/alt-arrow-left";
import { AltArrowRightIcon } from "@solar-icons/react-native/linear/alt-arrow-right";
import {
  BLOG_PAGE_SIZE,
  EXAM_TYPES,
  type ExamCalendarDto,
  type ExamType,
  type InfoArticleSummaryDto,
  type Paginated,
} from "@mentor/types";
import { getCatalog } from "../../i18n/index.js";
import { haptics } from "../../lib/haptics.js";
import {
  ARTICLE_CATEGORIES,
  showsFeaturedArticle,
  type ArticleCategory,
} from "../../lib/knowledge-view.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { PanelCard } from "../panel/primitives.js";
import { AppText, Skeleton, SlidingTabs, StateView } from "../ui/index.js";
import { ArticleRowsCard, FeaturedArticleCard } from "./article-cards.js";
import { ExamDayCard } from "./exam-day-card.js";
import { KnowledgeHubSkeleton } from "./knowledge-skeleton.js";

export type KnowledgeTopicTab = "ALL" | ArticleCategory;

export function KnowledgeHub({
  selectedFamily,
  selectedCategory,
  page,
  calendar,
  calendarLoading,
  calendarError,
  featured,
  articlesData,
  articlesLoading,
  articlesError,
  onSelectFamily,
  onSelectTopic,
  onSelectPage,
  onRetryCalendar,
  onRetryArticles,
  onOpenArticle,
}: {
  selectedFamily: ExamType;
  selectedCategory: KnowledgeTopicTab;
  page: number;
  calendar: ExamCalendarDto | null;
  calendarLoading: boolean;
  calendarError: boolean;
  featured: InfoArticleSummaryDto | null;
  articlesData: Paginated<InfoArticleSummaryDto> | undefined;
  articlesLoading: boolean;
  articlesError: boolean;
  onSelectFamily: (family: ExamType) => void;
  onSelectTopic: (topic: KnowledgeTopicTab) => void;
  onSelectPage: (page: number) => void;
  onRetryCalendar: () => void;
  onRetryArticles: () => void;
  onOpenArticle: (slug: string) => void;
}) {
  const { palette } = useThemeTokens();
  const { locale } = useLocale();
  const t = useTranslations("knowledge");
  const tCommon = useTranslations("common");
  const labels: Readonly<Partial<Record<string, string>>> = getCatalog(locale).knowledgeLabels;

  const activeCategory = selectedCategory === "ALL" ? null : selectedCategory;
  const hero = showsFeaturedArticle(featured, activeCategory, page) ? featured : null;
  const listItems = articlesData?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((articlesData?.total ?? 0) / BLOG_PAGE_SIZE));

  const topicLabel = (category: ArticleCategory) =>
    Object.hasOwn(labels, category) ? (labels[category] ?? t("article_category")) : t("article_category");

  return (
    <>
      <View style={styles.hubHeader}>
        <AppText variant="title">{t("title")}</AppText>
        <AppText variant="body" tone="secondary">
          {t("subtitle")}
        </AppText>
      </View>

      <SlidingTabs
        variant="pill"
        compact
        value={selectedFamily}
        onChange={(id) => onSelectFamily(id as ExamType)}
        accessibilityLabel={t("families_label")}
        items={EXAM_TYPES.map((family) => ({ id: family, label: family }))}
      />

      <SlidingTabs
        variant="underline"
        value={selectedCategory}
        onChange={(id) => onSelectTopic(id as KnowledgeTopicTab)}
        accessibilityLabel={t("topics_label")}
        items={[
          { id: "ALL", label: t("all_topics") },
          ...ARTICLE_CATEGORIES.map((category) => ({
            id: category,
            label: topicLabel(category),
          })),
        ]}
      />

      {calendarLoading ? (
        <PanelCard style={{ gap: 10 }}>
          <Skeleton width={110} height={14} />
          <Skeleton width={140} height={32} />
          <Skeleton width="80%" height={14} />
        </PanelCard>
      ) : calendarError ? (
        <StateView
          title={tCommon("error_title")}
          body={tCommon("error_body")}
          actionLabel={tCommon("retry")}
          onAction={onRetryCalendar}
          tone="error"
        />
      ) : (
        <ExamDayCard family={selectedFamily} calendar={calendar} />
      )}

      {articlesLoading ? (
        <KnowledgeHubSkeleton />
      ) : articlesError ? (
        <StateView
          title={tCommon("error_title")}
          body={t("list_error")}
          actionLabel={tCommon("retry")}
          onAction={onRetryArticles}
          tone="error"
        />
      ) : !hero && listItems.length === 0 ? (
        <PanelCard style={styles.emptyCard}>
          <AppText style={styles.emptyTitle}>
            {t(
              page > 1
                ? "empty_page_title"
                : activeCategory
                  ? "empty_topic_title"
                  : "empty_articles",
            )}
          </AppText>
          {page === 1 ? (
            <AppText variant="body" tone="secondary">
              {t("empty_desc")}
            </AppText>
          ) : null}
          {page > 1 || activeCategory ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                haptics.selection();
                if (page > 1) onSelectPage(1);
                else onSelectTopic("ALL");
              }}
              style={styles.emptyAction}
            >
              <AppText numberOfLines={1} style={[styles.emptyActionText, { color: palette.main }]}>
                {t(page > 1 ? "first_page_link" : "all_topics_link")}
              </AppText>
              <AltArrowRightIcon size={16} color={palette.main} strokeWidth={1.75} />
            </Pressable>
          ) : null}
        </PanelCard>
      ) : (
        <>
          {hero ? (
            <FeaturedArticleCard
              article={hero}
              onPress={() => onOpenArticle(hero.slug)}
            />
          ) : null}
          {listItems.length > 0 ? (
            <ArticleRowsCard
              articles={listItems}
              onSelect={onOpenArticle}
            />
          ) : null}
          {totalPages > 1 ? (
            <View accessibilityLabel={t("pagination_label")} style={styles.pagination}>
              {page > 1 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    haptics.selection();
                    onSelectPage(Math.max(1, page - 1));
                  }}
                  style={styles.pageBtn}
                >
                  <AltArrowLeftIcon size={16} color={palette.main} strokeWidth={1.75} />
                  <AppText numberOfLines={1} style={[styles.pageBtnLabel, { color: palette.main }]}>
                    {t("pagination_prev")}
                  </AppText>
                </Pressable>
              ) : (
                <View style={styles.pageSpacer} />
              )}
              <AppText
                variant="caption"
                tone="secondary"
                tabularNums
                style={{ fontWeight: "800" }}
              >
                {t("pagination_page", { page, pages: totalPages })}
              </AppText>
              {page < totalPages ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    haptics.selection();
                    onSelectPage(Math.min(totalPages, page + 1));
                  }}
                  style={styles.pageBtn}
                >
                  <AppText numberOfLines={1} style={[styles.pageBtnLabel, { color: palette.main }]}>
                    {t("pagination_next")}
                  </AppText>
                  <AltArrowRightIcon size={16} color={palette.main} strokeWidth={1.75} />
                </Pressable>
              ) : (
                <View style={styles.pageSpacer} />
              )}
            </View>
          ) : null}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  hubHeader: {
    gap: 4,
  },
  emptyCard: {
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  emptyAction: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 6,
  },
  emptyActionText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  pageBtn: {
    minHeight: 44,
    minWidth: 88,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  pageBtnLabel: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
  pageSpacer: {
    minWidth: 88,
  },
});
