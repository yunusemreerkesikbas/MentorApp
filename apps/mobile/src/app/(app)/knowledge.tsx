import { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewInstance,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AltArrowLeftIcon } from "@solar-icons/react-native/linear/alt-arrow-left";
import { BLOG_PAGE_SIZE, type ExamType } from "@mentor/types";
import { ArticleReader } from "../../components/knowledge/article-reader.js";
import {
  KnowledgeHub,
  type KnowledgeTopicTab,
} from "../../components/knowledge/knowledge-hub.js";
import { ArticleReaderSkeleton } from "../../components/knowledge/knowledge-skeleton.js";
import { AppText, StateView } from "../../components/ui/index.js";
import {
  fetchExamCalendarByType,
  fetchFeaturedArticle,
  getInfoArticleBySlug,
  listInfoArticles,
  recordArticleView,
} from "../../lib/content-api.js";
import { haptics } from "../../lib/haptics.js";
import { resolveExamFamilyParam } from "../../lib/knowledge-view.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";

export default function KnowledgeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ slug?: string; family?: string }>();
  const { user } = useAuth();
  const { palette, space } = useThemeTokens();
  const t = useTranslations("knowledge");
  const tCommon = useTranslations("common");
  const scrollRef = useRef<ScrollViewInstance>(null);

  const [selectedFamily, setSelectedFamily] = useState<ExamType>(() =>
    resolveExamFamilyParam(params.family, user?.examType),
  );
  const [selectedCategory, setSelectedCategory] = useState<KnowledgeTopicTab>("ALL");
  const [page, setPage] = useState(1);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    params.slug ?? null,
  );

  useEffect(() => {
    if (params.slug) {
      setSelectedSlug(params.slug);
    }
  }, [params.slug]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [selectedSlug, page, selectedFamily, selectedCategory]);

  const closeArticle = useCallback(() => setSelectedSlug(null), []);

  useFocusEffect(
    useCallback(() => {
      if (!selectedSlug) return;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        closeArticle();
        return true;
      });
      return () => subscription.remove();
    }, [closeArticle, selectedSlug]),
  );

  const detailQuery = useQuery({
    queryKey: ["content", "article-detail", selectedSlug],
    queryFn: () => getInfoArticleBySlug(selectedSlug!),
    enabled: Boolean(selectedSlug),
  });

  useEffect(() => {
    if (selectedSlug && detailQuery.data?.slug === selectedSlug) {
      void recordArticleView(selectedSlug);
    }
  }, [selectedSlug, detailQuery.data?.slug]);

  const activeCalendarFamily =
    selectedSlug && detailQuery.data
      ? (detailQuery.data.family as ExamType)
      : selectedFamily;
  const variantParam =
    activeCalendarFamily === user?.examType ? user.examVariant : null;

  const calendarQuery = useQuery({
    queryKey: ["content", "calendar", activeCalendarFamily, variantParam],
    queryFn: () => fetchExamCalendarByType(activeCalendarFamily, variantParam),
  });

  const featuredQuery = useQuery({
    queryKey: ["content", "featured", selectedFamily],
    queryFn: () => fetchFeaturedArticle(selectedFamily),
    enabled: !selectedSlug,
  });

  const activeCategory = selectedCategory === "ALL" ? null : selectedCategory;

  const articlesQuery = useQuery({
    queryKey: ["content", "articles", selectedFamily, selectedCategory, page],
    queryFn: () =>
      listInfoArticles(selectedFamily, page, {
        category: activeCategory ?? undefined,
        pageSize: BLOG_PAGE_SIZE,
      }),
    enabled: !selectedSlug,
  });

  const relatedQuery = useQuery({
    queryKey: ["content", "related", detailQuery.data?.family, detailQuery.data?.slug],
    queryFn: () =>
      listInfoArticles(detailQuery.data!.family, 1, {
        excludeSlug: detailQuery.data!.slug,
        pageSize: 4,
      }),
    enabled: Boolean(selectedSlug && detailQuery.data),
  });

  const relatedItems = (() => {
    const items = relatedQuery.data?.items ?? [];
    const currentCategory = detailQuery.data?.category;
    const sameCat = items.filter((i) => i.category === currentCategory);
    return (sameCat.length > 0 ? sameCat : items).slice(0, 3);
  })();

  const isRefreshing = selectedSlug
    ? detailQuery.isRefetching || calendarQuery.isRefetching
    : articlesQuery.isRefetching || calendarQuery.isRefetching;

  const handleRefresh = () => {
    void calendarQuery.refetch();
    if (selectedSlug) {
      void detailQuery.refetch();
      void relatedQuery.refetch();
    } else {
      void featuredQuery.refetch();
      void articlesQuery.refetch();
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <View
        style={[
          styles.topChrome,
          {
            paddingTop: insets.top,
            backgroundColor: palette.surface,
            borderBottomColor: palette.playLine,
          },
        ]}
      >
        <View style={styles.navBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(selectedSlug ? "close_article_cta" : "back_cta")}
            onPress={() => {
              haptics.selection();
              if (selectedSlug) closeArticle();
              else router.back();
            }}
            style={styles.backBtn}
          >
            <AltArrowLeftIcon size={22} color={palette.main} strokeWidth={1.75} />
          </Pressable>
          <AppText accessibilityRole="header" numberOfLines={1} style={styles.navTitle}>
            {t("title")}
          </AppText>
          {selectedSlug ? (
            <Pressable
              accessibilityRole="button"
              onPress={closeArticle}
              style={styles.listBtn}
            >
              <AppText variant="caption" style={{ color: palette.playSelectedInk, fontWeight: "800" }}>
                {t("close_article_cta")}
              </AppText>
            </Pressable>
          ) : (
            <View style={styles.navSpacer} />
          )}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={palette.accent}
          />
        }
        contentContainerStyle={{
          paddingTop: space.lg,
          paddingBottom: insets.bottom + space["2xl"],
          paddingHorizontal: space.xl,
          gap: space.lg,
        }}
      >
        {selectedSlug ? (
          detailQuery.isLoading ? (
            <ArticleReaderSkeleton />
          ) : detailQuery.isError || !detailQuery.data ? (
            <StateView
              title={tCommon("error_title")}
              body={t("detail_error")}
              actionLabel={tCommon("retry")}
              onAction={() => void detailQuery.refetch()}
              tone="error"
            />
          ) : (
            <ArticleReader
              article={detailQuery.data}
              calendar={calendarQuery.data ?? null}
              related={relatedItems}
              onSelectCategory={(cat) => {
                setSelectedFamily(detailQuery.data!.family as ExamType);
                setSelectedCategory(cat);
                setPage(1);
                setSelectedSlug(null);
              }}
              onSelectArticle={(slug) => {
                haptics.selection();
                setSelectedSlug(slug);
              }}
              onBackToList={closeArticle}
              onAskPuhu={() => {
                haptics.selection();
                router.push({
                  pathname: "/(app)/(tabs)/coach" as never,
                  params: {
                    contextArticleSlug: detailQuery.data!.slug,
                    seed: t("coach_seed", { title: detailQuery.data!.title }),
                  },
                });
              }}
            />
          )
        ) : (
          <KnowledgeHub
            selectedFamily={selectedFamily}
            selectedCategory={selectedCategory}
            page={page}
            calendar={calendarQuery.data ?? null}
            calendarLoading={calendarQuery.isLoading}
            calendarError={calendarQuery.isError}
            featured={featuredQuery.data ?? null}
            articlesData={articlesQuery.data}
            articlesLoading={articlesQuery.isLoading}
            articlesError={articlesQuery.isError}
            onSelectFamily={(nextFamily) => {
              setSelectedFamily(nextFamily);
              setPage(1);
            }}
            onSelectTopic={(nextTopic) => {
              setSelectedCategory(nextTopic);
              setPage(1);
            }}
            onSelectPage={setPage}
            onRetryCalendar={() => void calendarQuery.refetch()}
            onRetryArticles={() => void articlesQuery.refetch()}
            onOpenArticle={(slug) => {
              haptics.selection();
              setSelectedSlug(slug);
            }}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topChrome: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 4,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
  },
  listBtn: {
    minHeight: 44,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  navSpacer: {
    width: 44,
  },
  scroll: {
    flex: 1,
  },
});
