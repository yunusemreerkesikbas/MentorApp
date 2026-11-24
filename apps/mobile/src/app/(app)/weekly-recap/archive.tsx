import { useRef, useState, type ComponentRef } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PanelCard } from "../../../components/panel/primitives.js";
import { recapArchiveParams } from "../../../components/recap/recap-flow.js";
import { AppText, Button, ScreenLoadingSkeleton, StateView } from "../../../components/ui/index.js";
import { fetchWeeklyRecapArchive } from "../../../lib/coaching-api.js";
import { useAuth } from "../../../providers/auth-provider.js";
import { useLocale, useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";

export default function WeeklyRecapArchiveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { locale } = useLocale();
  const { status } = useAuth();
  const t = useTranslations("recap");
  const tCommon = useTranslations("common");
  const { palette, space, touchTargets } = useThemeTokens();
  const scrollView = useRef<ComponentRef<typeof ScrollView>>(null);
  const [page, setPage] = useState(1);
  const archive = useQuery({
    queryKey: ["weekly-recap-archive", page],
    queryFn: () => fetchWeeklyRecapArchive(page),
    enabled: status === "authenticated",
  });
  const data = archive.data;
  const hasNext = Boolean(data && data.page * data.pageSize < data.total);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
  const labelDate = (iso: string) => date.format(new Date(`${iso}T00:00:00Z`));
  const changePage = (next: number) => {
    setPage(next);
    scrollView.current?.scrollTo({ y: 0, animated: false });
  };
  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/analysis" as never);
  };

  return (
    <ScrollView
      ref={scrollView}
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + space.sm,
        paddingBottom: insets.bottom + space.xl,
        paddingHorizontal: space.lg,
        gap: space.md,
      }}
      refreshControl={
        <RefreshControl
          refreshing={archive.isRefetching}
          onRefresh={() => void archive.refetch()}
          tintColor={palette.accent}
        />
      }
    >
      <Pressable
        accessibilityRole="button"
        onPress={close}
        style={[styles.close, { minHeight: touchTargets.comfortable }]}
      >
        <AppText variant="cardTitle">{tCommon("close")}</AppText>
      </Pressable>
      <AppText variant="title" accessibilityRole="header">{t("archive_title")}</AppText>
      {archive.isPending ? (
        <ScreenLoadingSkeleton />
      ) : !data ? (
        <StateView
          title={t("archive_load_error")}
          body={tCommon("error_body")}
          actionLabel={tCommon("retry")}
          onAction={() => void archive.refetch()}
          tone="error"
        />
      ) : data.items.length === 0 ? (
        <PanelCard>
          <AppText tone="secondary">{t(page === 1 ? "archive_empty" : "archive_page_empty")}</AppText>
        </PanelCard>
      ) : (
        <PanelCard>
          {data.items.map((item, index) => {
            const range = `${labelDate(item.weekStart)} · ${labelDate(item.endDate)}`;
            const action = t(item.requiresOpening ? "access_open" : "access_replay");
            return (
              <Pressable
                accessibilityRole="button"
                key={item.id}
                style={({ pressed }) => [
                  styles.row,
                  { minHeight: touchTargets.comfortable, borderColor: palette.border },
                  index > 0 && styles.divider,
                  pressed && styles.pressed,
                ]}
                onPress={() => router.push({
                  pathname: "/(app)/weekly-recap" as never,
                  params: recapArchiveParams(item),
                })}
              >
                <AppText style={styles.range}>{range}</AppText>
                <AppText variant="caption" style={{ fontWeight: "800" }}>{action}</AppText>
              </Pressable>
            );
          })}
        </PanelCard>
      )}
      {page > 1 || hasNext ? (
        <View style={styles.pages}>
          <Button
            style={styles.pageButton}
            variant="secondary"
            label={t("archive_previous")}
            disabled={page === 1}
            onPress={() => changePage(page - 1)}
          />
          <Button
            style={styles.pageButton}
            variant="secondary"
            label={t("archive_next")}
            disabled={!hasNext}
            onPress={() => changePage(page + 1)}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  close: { alignSelf: "flex-start", justifyContent: "center" },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.75 },
  range: { flexGrow: 1, flexShrink: 1 },
  pages: { flexDirection: "row", gap: 8 },
  pageButton: { flex: 1 },
});
