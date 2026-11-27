import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { AltArrowLeftIcon } from "@solar-icons/react-native/linear/alt-arrow-left";
import { Image } from "expo-image";
import { roundFocusMinutes } from "@mentor/core";
import { PanelCard } from "../../components/panel/primitives.js";
import { AppText, Button, Chip, Skeleton, StateView } from "../../components/ui/index.js";
import { art } from "../../lib/art.js";
import { listStudySessions } from "../../lib/coaching-api.js";
import {
  HISTORY_DATE_PRESETS,
  distinctSubjects,
  groupSessionsByDay,
  historyDateRange,
  type HistoryDatePreset,
} from "../../lib/session-view.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";

const PAGE_SIZE = 20;

/** The web's session history: date and subject filters, sessions grouped by day, load more. */
export default function StudySessionHistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { palette, space } = useThemeTokens();
  const { locale } = useLocale();
  const t = useTranslations("session");
  const [range, setRange] = useState<HistoryDatePreset>("all");
  const [subject, setSubject] = useState<string | null>(null);
  // Subject chips come from an unfiltered page, so picking one does not hide the others.
  const subjects = useQuery({
    queryKey: ["study-sessions", "history", "subjects"],
    queryFn: async () => distinctSubjects((await listStudySessions(1, 50)).items),
  });
  const knownSubjects = subjects.data ?? [];

  const history = useInfiniteQuery({
    queryKey: ["study-sessions", "history", range, subject],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      listStudySessions(pageParam, PAGE_SIZE, { ...historyDateRange(range), subject: subject ?? undefined }),
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  });
  const items = useMemo(() => history.data?.pages.flatMap((page) => page.items) ?? [], [history.data]);
  const groups = groupSessionsByDay(items);
  const filtered = range !== "all" || subject != null;

  const dayLabel = (iso: string) => {
    const day = new Date(iso);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (day.toDateString() === new Date().toDateString()) return t("history_date_today");
    if (day.toDateString() === yesterday.toDateString()) return t("history_day_yesterday");
    return day.toLocaleDateString(locale, { day: "numeric", month: "long", weekday: "long" });
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <View style={[styles.chrome, { paddingTop: insets.top, backgroundColor: palette.surface, borderBottomColor: palette.playLine }]}>
        <View style={styles.navBar}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("back_cta")} onPress={() => router.back()} style={styles.iconBtn}>
            <AltArrowLeftIcon size={22} color={palette.main} strokeWidth={1.75} />
          </Pressable>
          <AppText accessibilityRole="header" style={styles.navTitle} numberOfLines={1}>{t("history_title")}</AppText>
          <View style={styles.iconBtn} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: insets.bottom + 24, gap: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={t("history_date_filter_label")}
          contentContainerStyle={styles.chips}>
          {HISTORY_DATE_PRESETS.map((preset) => (
            <Chip key={preset} label={t(`history_date_${preset}`)} selected={range === preset} onPress={() => setRange(preset)} />
          ))}
        </ScrollView>
        {knownSubjects.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={t("history_subject_filter_label")}
            contentContainerStyle={styles.chips}>
            <Chip label={t("history_filter_all")} selected={subject == null} onPress={() => setSubject(null)} />
            {knownSubjects.map((name) => (
              <Chip key={name} label={name} selected={subject === name} onPress={() => setSubject(name)} />
            ))}
          </ScrollView>
        ) : null}

        {history.isPending ? (
          <View style={{ gap: 8 }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={64} borderRadius={16} />)}
          </View>
        ) : history.isError ? (
          <StateView tone="error" title={t("history_title")} body={t("history_error")} actionLabel={t("retry")} onAction={() => void history.refetch()} />
        ) : items.length === 0 ? (
          <PanelCard style={styles.empty}>
            <Image source={art.puhuEncouraging} style={styles.emptyArt} contentFit="contain" accessible={false} />
            <AppText tone="secondary" style={{ textAlign: "center" }}>{filtered ? t("history_empty_filtered") : t("history_empty")}</AppText>
          </PanelCard>
        ) : (
          groups.map((group) => (
            <View key={group.key} style={{ gap: 8 }}>
              <AppText variant="caption" tone="secondary" style={styles.dayLabel}>{dayLabel(group.items[0]!.startedAt)}</AppText>
              <PanelCard style={{ gap: 0, paddingVertical: 4 }}>
                {group.items.map((item, index) => {
                  const abandoned = item.status === "ABANDONED";
                  return (
                    <View key={item.id} style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: palette.playLine }]}>
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <AppText numberOfLines={1} style={{ fontWeight: "800" }}>
                          {item.subject ?? t("title")}
                        </AppText>
                        <AppText variant="caption" tone="secondary" numberOfLines={1}>
                          {new Date(item.startedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                          {item.planTaskTitle ? ` · ${t("history_plan_task", { title: item.planTaskTitle })}` : ""}
                        </AppText>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 2 }}>
                        <AppText tabularNums style={{ fontWeight: "800" }}>
                          {t("minutes_value", { minutes: roundFocusMinutes(item.actualFocusSeconds) })}
                        </AppText>
                        <AppText variant="caption" tone={abandoned ? "secondary" : "success"}>
                          {abandoned ? t("history_abandoned") : t("history_completed")}
                        </AppText>
                      </View>
                    </View>
                  );
                })}
              </PanelCard>
            </View>
          ))
        )}

        {history.hasNextPage ? (
          <Button label={t("history_load_more")} variant="secondary" loading={history.isFetchingNextPage}
            onPress={() => void history.fetchNextPage()} />
        ) : null}
        {history.isFetchNextPageError ? <AppText tone="danger">{t("history_load_more_error")}</AppText> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  chrome: { borderBottomWidth: 1 },
  navBar: { height: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  navTitle: { flex: 1, textAlign: "center", fontWeight: "800", fontSize: 17 },
  chips: { gap: 8, paddingRight: 8 },
  empty: { alignItems: "center", gap: 12, paddingVertical: 24 },
  emptyArt: { width: 96, height: 96 },
  // No textTransform: Android uppercases Turkish "i" to "I" (PAZARTESI).
  dayLabel: { fontWeight: "800" },
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
});
