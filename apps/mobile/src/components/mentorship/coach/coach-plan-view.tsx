import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  formatTimeRange,
  formatWeekRangeLabel,
  formatWeekdayShort,
  shiftDate,
  todayIso,
  weekDates,
  weekStart,
} from "@mentor/core";
import type { CoachPlanItemDto } from "@mentor/types";
import { haptics } from "../../../lib/haptics.js";
import { tabBarClearance } from "../../../lib/layout.js";
import { fetchRoster } from "../../../lib/mentorship-api.js";
import { fetchCoachPlan } from "../../../lib/mentorship-plan-api.js";
import { extractMentorshipError } from "../../../lib/mentorship-view.js";
import { useLocale, useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { PanelCard, PanelCardTitle } from "../../panel/primitives.js";
import { AppText, Button, Chip, Skeleton, StateView } from "../../ui/index.js";
import { CoachPlanSheets, type CoachPlanModal } from "./coach-plan-sheets.js";

export function CoachPlanView() {
  const t = useTranslations("students");
  const tCommon = useTranslations("common");
  const { locale } = useLocale();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { palette, radii, space } = useThemeTokens();

  const today = todayIso();
  const [anchorWeek, setAnchorWeek] = useState(() => weekStart(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [studentFilter, setStudentFilter] = useState<string | null>(null);
  const [modal, setModal] = useState<CoachPlanModal | null>(null);

  const rosterQuery = useQuery({
    queryKey: ["mentorship-roster", "ACTIVE"],
    queryFn: () => fetchRoster("ACTIVE"),
  });

  const planQuery = useQuery({
    queryKey: ["mentorship-coach-plan", anchorWeek, studentFilter],
    queryFn: () =>
      fetchCoachPlan({
        from: anchorWeek,
        to: shiftDate(anchorWeek, 6),
        ...(studentFilter ? { studentId: studentFilter } : {}),
      }),
  });

  const days = useMemo(() => weekDates(anchorWeek), [anchorWeek]);
  const roster = rosterQuery.data ?? [];
  const items = planQuery.data ?? [];

  const dayItems = useMemo(
    () =>
      items.filter((item) =>
        item.kind === "TASK"
          ? item.task.taskDate === selectedDate
          : item.event.eventDate === selectedDate,
      ),
    [items, selectedDate],
  );

  const reloadAll = () => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["mentorship-coach-plan"] }),
      queryClient.invalidateQueries({ queryKey: ["mentorship-roster", "ACTIVE"] }),
    ]);
  };

  const renderItem = (item: CoachPlanItemDto) => {
    const isTask = item.kind === "TASK";
    const key = isTask ? `t-${item.task.id}` : `e-${item.event.id}`;
    const title = isTask ? item.task.title : item.event.title;
    const time = isTask
      ? formatTimeRange(item.task.startTime, item.task.endTime)
      : formatTimeRange(item.event.startTime, item.event.endTime);
    const names = isTask
      ? item.task.participants.map((p) => p.studentDisplayName)
      : item.event.attendees.map((a) => a.studentDisplayName);

    return (
      <Pressable
        key={key}
        accessibilityRole="button"
        onPress={() => {
          void haptics.selection();
          setModal({ kind: "DETAIL", item });
        }}
        style={({ pressed }) => [
          styles.itemRow,
          {
            backgroundColor: pressed ? palette.surfaceHover : palette.surfaceAlt,
            borderColor: isTask ? palette.border : palette.coachAccent,
            borderRadius: radii.inner,
          },
        ]}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.rowBetween}>
            <AppText variant="cardTitle" style={{ flex: 1 }}>
              {title}
            </AppText>
            <Chip
              label={
                isTask
                  ? t("coach_plan_task_badge")
                  : item.event.status === "CANCELLED"
                    ? t("followup_status_CANCELLED")
                    : t("coach_plan_event_badge")
              }
              tone={
                isTask
                  ? "default"
                  : item.event.status === "CANCELLED"
                    ? "warning"
                    : "coach"
              }
            />
          </View>
          {time ? (
            <AppText variant="micro" tone="secondary" tabularNums>
              {time}
            </AppText>
          ) : null}
          {names.length > 0 ? (
            <AppText variant="caption" tone="secondary" numberOfLines={2}>
              {names.join(", ")}
            </AppText>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: palette.bg }}
        contentContainerStyle={{
          paddingTop: space.lg,
          paddingHorizontal: space.lg,
          paddingBottom: tabBarClearance(insets.bottom),
          gap: space.md,
        }}
        refreshControl={
          <RefreshControl
            refreshing={planQuery.isRefetching || rosterQuery.isRefetching}
            onRefresh={reloadAll}
            tintColor={palette.coachAccent}
          />
        }
      >
        <View style={{ gap: 4 }}>
          <AppText variant="caption" tone="coach">
            {t("badge")}
          </AppText>
          <AppText variant="title">{t("coach_plan_title")}</AppText>
          <AppText variant="body" tone="secondary">
            {t("coach_plan_subtitle")}
          </AppText>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipStrip}>
          <Chip
            label={t("coach_plan_all_students")}
            selected={studentFilter === null}
            tone="coach"
            onPress={() => setStudentFilter(null)}
          />
          {roster
            .filter((r) => r.seat !== "NONE")
            .map((row) => (
              <Chip
                key={row.studentId}
                label={row.studentDisplayName}
                selected={studentFilter === row.studentId}
                tone="coach"
                onPress={() => setStudentFilter(row.studentId)}
              />
            ))}
        </ScrollView>

        <PanelCard style={{ gap: space.sm }}>
          <AppText variant="cardTitle" style={{ textAlign: "center" }}>
            {formatWeekRangeLabel(anchorWeek, shiftDate(anchorWeek, 6), locale)}
          </AppText>
          <View style={styles.weekBar}>
            <Button
              label={t("pager_prev")}
              variant="secondary"
              onPress={() => {
                const prev = shiftDate(anchorWeek, -7);
                setAnchorWeek(prev);
                setSelectedDate(prev);
              }}
              style={{ flex: 1 }}
            />
            <Button
              label={t("pager_next")}
              variant="secondary"
              onPress={() => {
                const next = shiftDate(anchorWeek, 7);
                setAnchorWeek(next);
                setSelectedDate(next);
              }}
              style={{ flex: 1 }}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipStrip}>
            {days.map((iso) => {
              const count = items.filter((item) =>
                item.kind === "TASK"
                  ? item.task.taskDate === iso
                  : item.event.eventDate === iso,
              ).length;
              return (
                <Chip
                  key={iso}
                  label={`${formatWeekdayShort(iso, locale)} ${iso.slice(8)}${count ? ` (${count})` : ""}`}
                  selected={selectedDate === iso}
                  tone="coach"
                  onPress={() => setSelectedDate(iso)}
                />
              );
            })}
          </ScrollView>
        </PanelCard>

        {roster.some((r) => r.seat !== "NONE") ? (
          <View style={styles.actionRow}>
            <Button
              label={t("coach_plan_new_task")}
              onPress={() => setModal({ kind: "TASK_CREATE", date: selectedDate })}
              style={styles.actionBtn}
            />
            <Button
              label={t("coach_plan_new_event")}
              variant="secondary"
              onPress={() => setModal({ kind: "EVENT_CREATE", date: selectedDate })}
              style={styles.actionBtn}
            />
          </View>
        ) : null}

        {planQuery.isLoading ? (
          <Skeleton height={160} />
        ) : planQuery.isError ? (
          <StateView
            title={tCommon("error_title")}
            body={extractMentorshipError(planQuery.error, tCommon("error_body"))}
            actionLabel={tCommon("retry")}
            onAction={() => void planQuery.refetch()}
            tone="error"
          />
        ) : dayItems.length === 0 ? (
          <PanelCard style={{ gap: 4 }}>
            <PanelCardTitle>{t("coach_plan_day_empty_title")}</PanelCardTitle>
            <AppText variant="caption" tone="secondary">
              {t("coach_plan_day_empty_body")}
            </AppText>
          </PanelCard>
        ) : (
          <View style={{ gap: space.sm }}>{dayItems.map(renderItem)}</View>
        )}
      </ScrollView>

      <CoachPlanSheets
        modal={modal}
        roster={roster}
        onClose={() => setModal(null)}
        onOpenEdit={(next) => setModal(next)}
        onChanged={() => {
          setModal(null);
          reloadAll();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chipStrip: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  weekBar: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionBtn: { flexGrow: 1, minWidth: 165 },
  itemRow: {
    borderWidth: 1,
    padding: 12,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
});
