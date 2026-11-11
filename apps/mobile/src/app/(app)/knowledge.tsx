import { useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ExamType } from "@mentor/types";
import {
  AppText,
  Button,
  Card,
  Chip,
  ScreenLoadingSkeleton,
  StateView,
} from "../../components/ui/index.js";
import {
  fetchExamCalendarByType,
  getInfoArticleBySlug,
  listInfoArticles,
} from "../../lib/content-api.js";
import { haptics } from "../../lib/haptics.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";

export default function KnowledgeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ slug?: string }>();
  const { user } = useAuth();
  const { palette, radii, space } = useThemeTokens();
  const t = useTranslations("knowledge");
  const tCommon = useTranslations("common");

  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    params.slug ?? null,
  );

  const examType = user?.examType ?? ExamType.YKS;

  const calendarQuery = useQuery({
    queryKey: ["content", "calendar", examType],
    queryFn: () => fetchExamCalendarByType(examType),
  });

  const articlesQuery = useQuery({
    queryKey: ["content", "articles", examType],
    queryFn: () => listInfoArticles(examType, 1),
  });

  const detailQuery = useQuery({
    queryKey: ["content", "article-detail", selectedSlug],
    queryFn: () => getInfoArticleBySlug(selectedSlug!),
    enabled: Boolean(selectedSlug),
  });

  const articles = articlesQuery.data?.items ?? [];
  const calendar = calendarQuery.data;
  const articleDetail = detailQuery.data;

  return (
    <FlatList
      data={selectedSlug ? [] : articles}
      keyExtractor={(item) => item.slug}
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        <RefreshControl
          refreshing={articlesQuery.isRefetching}
          onRefresh={() => {
            void calendarQuery.refetch();
            void articlesQuery.refetch();
          }}
          tintColor={palette.accent}
        />
      }
      contentContainerStyle={{
        paddingTop: insets.top + space.lg,
        paddingBottom: space.xl,
        paddingHorizontal: space.lg,
        gap: space.md,
      }}
      ListHeaderComponent={
        <View style={{ gap: space.lg }}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="title">{t("title")}</AppText>
              <AppText variant="caption" tone="secondary">
                {t("subtitle")}
              </AppText>
            </View>
            <Chip label={t("back_cta")} onPress={() => router.back()} />
          </View>

          {/* Official Exam Calendar Data Card (Guardrail §4 #1 — verbatim) */}
          {calendar ? (
            <Card style={{ gap: space.sm }}>
              <View style={styles.rowBetween}>
                <AppText variant="sectionHeading">
                  {t("calendar_title")}
                </AppText>
                <Chip label={calendar.exam.name} selected />
              </View>
              {calendar.examDateLabel ? (
                <AppText variant="cardTitle">{calendar.examDateLabel}</AppText>
              ) : null}
              {calendar.events.map((ev, idx) => (
                <View
                  key={`${ev.type}-${idx}`}
                  style={{
                    padding: space.sm,
                    borderRadius: radii.inner,
                    backgroundColor: palette.surfaceAlt,
                    gap: 2,
                  }}
                >
                  <View style={styles.rowBetween}>
                    <AppText variant="caption">{ev.type}</AppText>
                    <AppText variant="caption" tabularNums>
                      {ev.eventAt.slice(0, 10)}
                    </AppText>
                  </View>
                  <AppText variant="micro" tone="muted">
                    {t("verified_by", {
                      source: ev.source,
                      verifier: ev.verifiedBy,
                    })}
                  </AppText>
                </View>
              ))}
            </Card>
          ) : null}

          {/* Selected Article Reader or List Heading */}
          {selectedSlug ? (
            detailQuery.isLoading ? (
              <ScreenLoadingSkeleton />
            ) : articleDetail ? (
              <Card style={{ gap: space.md }}>
                <View style={styles.rowBetween}>
                  <Chip label={articleDetail.category} selected />
                  <Chip
                    label={t("close_article_cta")}
                    onPress={() => setSelectedSlug(null)}
                  />
                </View>
                <AppText variant="sectionHeading">
                  {articleDetail.title}
                </AppText>
                <AppText variant="micro" tone="muted">
                  {t("verified_by", {
                    source: articleDetail.source,
                    verifier: articleDetail.verifiedBy,
                  })}
                </AppText>
                <AppText variant="body" tone="secondary">
                  {articleDetail.body}
                </AppText>
                <Button
                  label={t("ask_puhu_cta")}
                  onPress={() => {
                    haptics.selection();
                    router.push({
                      pathname: "/(app)/(tabs)/coach" as never,
                      params: {
                        contextArticleSlug: articleDetail.slug,
                        seed: articleDetail.title,
                      },
                    });
                  }}
                />
              </Card>
            ) : null
          ) : (
            <AppText variant="sectionHeading">{t("articles_title")}</AppText>
          )}
        </View>
      }
      ListEmptyComponent={
        selectedSlug ? null : articlesQuery.isLoading ? (
          <ScreenLoadingSkeleton />
        ) : articlesQuery.isError ? (
          <StateView
            title={tCommon("error_title")}
            body={tCommon("error_body")}
            actionLabel={tCommon("retry")}
            onAction={() => void articlesQuery.refetch()}
            tone="error"
          />
        ) : (
          <Card>
            <AppText variant="body" tone="secondary">
              {t("empty_articles")}
            </AppText>
          </Card>
        )
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => {
            haptics.selection();
            setSelectedSlug(item.slug);
          }}
          style={{
            padding: space.md,
            borderRadius: radii.inner,
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.surface,
            gap: 6,
          }}
        >
          <View style={styles.rowBetween}>
            <Chip label={item.category} />
            <AppText variant="micro" tone="muted">
              {item.updatedAt.slice(0, 10)}
            </AppText>
          </View>
          <AppText variant="cardTitle">{item.title}</AppText>
          {item.metaDescription ? (
            <AppText variant="body" tone="secondary">
              {item.metaDescription}
            </AppText>
          ) : null}
          <AppText variant="micro" tone="muted">
            {t("verified_by", {
              source: item.source,
              verifier: item.verifiedBy,
            })}
          </AppText>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
});
