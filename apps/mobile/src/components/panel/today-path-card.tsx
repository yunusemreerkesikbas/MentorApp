import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { PlayIcon } from "@solar-icons/react-native/bold/play";
import { AddIcon } from "@solar-icons/react-native/linear/add";
import { buildTodayPath, type PathNode } from "@mentor/core";
import type {
  PlanTaskDto,
  PlanTaskStatus,
  TodayPanelResponse,
  WeeklyChestView,
} from "@mentor/types";
import { cardShadow } from "../../lib/layout.js";
import { useDailyGreeting } from "../../lib/premium.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/text.js";
import { CompanionBubble } from "./companion-bubble.js";
import { ActionSheet, LedgeButton } from "./primitives.js";
import { TodayPath } from "./today-path.js";
import { WeekBand } from "./week-band.js";

/**
 * "Bugünün yolu": the panel's one primary action (the web's `TodayPathCard`). Puhu's line, the
 * day as a path, the single next step as a play ledge, and this week underneath.
 */
export function TodayPathCard({
  data,
  chest,
  busyTaskId,
  onSetStatus,
  onStartSession,
  onChestPress,
  onOpenPlan,
}: {
  data: TodayPanelResponse;
  chest: WeeklyChestView | null;
  busyTaskId: string | null;
  onSetStatus: (task: PlanTaskDto, status: PlanTaskStatus) => void;
  /** No task: a free session. */
  onStartSession: (task?: PlanTaskDto) => void;
  onChestPress: (chest: WeeklyChestView) => void;
  onOpenPlan: () => void;
}) {
  const t = useTranslations("panel");
  const { palette, radii } = useThemeTokens();
  const [menuNode, setMenuNode] = useState<PathNode | null>(null);
  const greeting = useDailyGreeting();

  const defaultMinutes = data.sessionPresets[0]?.focusMinutes ?? 25;
  const path = buildTodayPath(data.tasks, defaultMinutes);
  const { cta } = path;

  const title =
    cta.kind === "START_TASK"
      ? cta.minutes === null
        ? t("path_title_stopwatch", { count: path.total })
        : t("path_title_start", { count: path.total, minutes: cta.minutes })
      : cta.kind === "ADD_TASK"
        ? t("path_title_empty")
        : t("path_title_done");

  const ambient =
    cta.kind === "DAY_COMPLETE" && data.focusGoal.focusMinutesToday > 0
      ? data.focusGoal.goalMinutes != null
        ? t("ambient_done_goal", {
            minutes: data.focusGoal.focusMinutesToday,
            goal: data.focusGoal.goalMinutes,
          })
        : t("ambient_done", { minutes: data.focusGoal.focusMinutesToday })
      : data.focusingNow != null && data.focusingNow > 0
        ? t("ambient_focusing_now", { count: data.focusingNow })
        : null;

  return (
    <View
      style={[
        styles.card,
        cardShadow,
        { backgroundColor: palette.surface, borderColor: palette.border, borderRadius: radii.card },
      ]}
    >
      <View style={styles.body}>
        <CompanionBubble
          text={greeting ?? data.motivationalLine}
          aiLabel={greeting ? t("path_note_label") : null}
          mood={cta.kind === "DAY_COMPLETE" ? "happy" : "default"}
        />

        <AppText accessibilityRole="header" style={styles.title}>
          {title}
        </AppText>

        <TodayPath
          path={path}
          chest={chest}
          busyTaskId={busyTaskId}
          onNodePress={setMenuNode}
          onChestPress={onChestPress}
          onAddTask={onOpenPlan}
          onOpenPlan={onOpenPlan}
        />

        <View style={styles.actions}>
          {cta.kind === "START_TASK" ? (
            <LedgeButton
              accessibilityLabel={`${cta.task.title} ${
                cta.minutes === null
                  ? t("cta_stopwatch")
                  : t("cta_start_minutes", { minutes: cta.minutes })
              }`}
              onPress={() => onStartSession(cta.task)}
            >
              {(ink) => (
                <>
                  <PlayIcon size={18} color={ink} />
                  <AppText numberOfLines={1} style={[styles.ledgeTitle, { color: ink }]}>
                    {cta.task.title}
                  </AppText>
                  <AppText style={[styles.ledgeSuffix, { color: ink }]}>
                    {cta.minutes === null
                      ? t("cta_stopwatch")
                      : t("cta_start_minutes", { minutes: cta.minutes })}
                  </AppText>
                </>
              )}
            </LedgeButton>
          ) : cta.kind === "ADD_TASK" ? (
            <LedgeButton accessibilityLabel={t("cta_add_task")} onPress={onOpenPlan}>
              {(ink) => (
                <>
                  <AddIcon size={20} color={ink} strokeWidth={2.5} />
                  <AppText style={[styles.ledgeSuffix, { color: ink }]}>{t("cta_add_task")}</AppText>
                </>
              )}
            </LedgeButton>
          ) : (
            <LedgeButton
              variant="outline"
              accessibilityLabel={t("cta_free_study")}
              onPress={() => onStartSession()}
            >
              {(ink) => (
                <>
                  <PlayIcon size={18} color={ink} />
                  <AppText style={[styles.ledgeSuffix, { color: ink }]}>{t("cta_free_study")}</AppText>
                </>
              )}
            </LedgeButton>
          )}

          {cta.kind !== "ADD_TASK" ? (
            <Pressable accessibilityRole="link" onPress={onOpenPlan} style={styles.planLink}>
              <AppText style={[styles.planLinkText, { color: palette.playSelectedInk }]}>
                {cta.kind === "DAY_COMPLETE" ? t("cta_see_plan") : t("plan_edit")}
              </AppText>
            </Pressable>
          ) : null}
        </View>

        {ambient ? (
          <View style={styles.ambient}>
            <View style={[styles.ambientDot, { backgroundColor: palette.ctaPlayBg }]} />
            <AppText style={[styles.ambientText, { color: palette.secondary }]}>{ambient}</AppText>
          </View>
        ) : null}
      </View>

      <WeekBand week={data.streak.week} streak={data.streak.currentStreak} focusGoal={data.focusGoal} />

      <ActionSheet
        title={menuNode ? menuNode.task.title : null}
        onClose={() => setMenuNode(null)}
        actions={
          menuNode === null
            ? []
            : menuNode.state === "done"
              ? [{ label: t("node_undo"), onPress: () => onSetStatus(menuNode.task, "PENDING") }]
              : [
                  { label: t("node_start"), onPress: () => onStartSession(menuNode.task) },
                  {
                    label: t("node_mark_done"),
                    onPress: () => onSetStatus(menuNode.task, "DONE"),
                  },
                ]
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: "hidden",
  },
  body: {
    gap: 16,
    padding: 20,
  },
  title: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "800",
  },
  actions: {
    gap: 8,
  },
  ledgeTitle: {
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  ledgeSuffix: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  planLink: {
    alignSelf: "flex-end",
    minHeight: 44,
    justifyContent: "center",
  },
  planLinkText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  ambient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: -4,
  },
  ambientDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ambientText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
});
