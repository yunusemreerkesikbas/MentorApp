import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HistoryIcon } from "@solar-icons/react-native/linear/history";
import { PenIcon } from "@solar-icons/react-native/linear/pen";
import { MinusIcon } from "@solar-icons/react-native/linear/minus";
import { AddIcon } from "@solar-icons/react-native/linear/add";
import { CheckCircleIcon } from "@solar-icons/react-native/bold/check-circle";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import type { FocusGoalDto } from "@mentor/types";
import { listStudySessions } from "../../lib/coaching-api.js";
import { haptics } from "../../lib/haptics.js";
import { historyDateRange } from "../../lib/session-view.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useToast } from "../../providers/toast-provider.js";
import { AppText, Button, Skeleton } from "../ui/index.js";
import { StageCard, useStageLook } from "./session-stage.js";

const GOAL_MIN = 15;
const GOAL_MAX = 600;
const GOAL_STEP = 15;
const DEFAULT_GOAL = 120;

/** The web's `SessionTodayCard`: today's focus minutes against the daily goal, editable in place. */
export function SessionTodayCard({ focusGoal }: { focusGoal: FocusGoalDto | null | undefined }) {
  const t = useTranslations("session");
  const look = useStageLook();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_GOAL);
  const [saving, setSaving] = useState(false);
  const today = useQuery({
    queryKey: ["study-sessions", "today"],
    queryFn: async () => (await listStudySessions(1, 20, historyDateRange("today"))).items,
  });

  if (focusGoal === null) return null;
  if (focusGoal === undefined || today.isPending) {
    return (
      <StageCard title={t("today_title")}>
        <Skeleton width={128} height={32} />
        <Skeleton width="100%" height={12} />
        <Skeleton width={176} height={16} />
      </StageCard>
    );
  }

  const sessions = today.data ?? [];
  const goal = focusGoal.goalMinutes ?? null;
  const focused = focusGoal.focusMinutesToday ?? 0;
  const completed = sessions.filter((s) => s.status === "COMPLETED" && s.countsAsFocusSession !== false).length;
  const abandoned = sessions.filter((s) => s.status === "ABANDONED").length;
  const reached = goal != null && focused >= goal;

  const save = async (value: number | null) => {
    setSaving(true);
    try {
      await usersControllerUpdateMe({ dailyFocusGoalMinutes: value });
      await queryClient.invalidateQueries({ queryKey: ["coaching", "today"] });
      haptics.success();
      setEditing(false);
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.body.message : t("goal_save_error_title"));
    } finally {
      setSaving(false);
    }
  };

  const startEditing = () => {
    setDraft(goal ?? DEFAULT_GOAL);
    setEditing(true);
  };

  const quiet = { color: look.inkSoft, fontWeight: "700" } as const;
  const link = { color: look.scenic ? look.ink : look.selectedInk, fontWeight: "800" } as const;

  return (
    <StageCard
      title={editing ? t("goal_title") : t("today_title")}
      action={goal != null && !editing ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t("goal_edit_aria")} onPress={startEditing} hitSlop={8} style={styles.icon}>
          <PenIcon size={20} color={look.inkSoft} />
        </Pressable>
      ) : null}
    >
      {editing ? (
        <View style={styles.editor}>
          <View style={styles.stepper}>
            <Step label={t("goal_decrease_aria")} disabled={saving || draft <= GOAL_MIN}
              onPress={() => setDraft(Math.max(GOAL_MIN, draft - GOAL_STEP))}><MinusIcon size={20} color={look.ink} /></Step>
            <AppText accessibilityLiveRegion="polite" tabularNums style={[styles.draft, { color: look.ink }]}>
              {t("minutes_value", { minutes: draft })}
            </AppText>
            <Step label={t("goal_increase_aria")} disabled={saving || draft >= GOAL_MAX}
              onPress={() => setDraft(Math.min(GOAL_MAX, draft + GOAL_STEP))}><AddIcon size={20} color={look.ink} /></Step>
          </View>
          <Button label={t("goal_save")} variant="secondary" loading={saving} onPress={() => void save(draft)} />
          <View style={styles.links}>
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => setEditing(false)} style={styles.link}>
              <AppText style={quiet}>{t("goal_cancel")}</AppText>
            </Pressable>
            {goal != null ? (
              <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save(null)} style={styles.link}>
                <AppText style={quiet}>{t("goal_remove")}</AppText>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : (
        <>
          <View style={styles.figure}>
            <AppText tabularNums style={[styles.big, { color: look.ink }]}>{focused}</AppText>
            <AppText style={quiet}>{goal != null ? t("today_of_goal", { goal }) : t("today_focus_unit")}</AppText>
          </View>
          {goal != null ? (
            <View accessible accessibilityRole="progressbar"
              accessibilityLabel={t("today_strip_aria", { goal, minutes: focused })}
              style={[styles.track, { backgroundColor: look.track }]}>
              <View style={[styles.fill, {
                width: `${Math.min(1, focused / Math.max(1, goal)) * 100}%`,
                minWidth: focused > 0 ? 12 : 0,
                backgroundColor: reached ? look.live : look.progress,
              }]} />
            </View>
          ) : null}
          <View style={styles.lines}>
            {reached ? (
              <View style={styles.reached}>
                <CheckCircleIcon size={18} color={look.live} />
                <AppText style={{ color: look.live, fontWeight: "800" }}>{t("goal_reached")}</AppText>
              </View>
            ) : (
              <AppText style={quiet}>
                {goal != null
                  ? focused > 0 ? t("today_remaining", { minutes: goal - focused }) : t("today_empty_goal")
                  : completed === 0 ? t("today_done_none") : t("today_done", { count: completed })}
              </AppText>
            )}
            {abandoned > 0 ? <AppText style={quiet}>{t("today_abandoned", { count: abandoned })}</AppText> : null}
          </View>
          {goal == null ? (
            <Pressable accessibilityRole="button" onPress={startEditing} style={styles.link}>
              <AppText style={link}>{t("goal_set_cta")}</AppText>
            </Pressable>
          ) : null}
        </>
      )}
      <Pressable accessibilityRole="button" onPress={() => router.push("/(app)/study-session-history" as never)}
        style={[styles.link, styles.historyLink]}>
        <HistoryIcon size={18} color={goal == null && !editing ? look.inkSoft : link.color} />
        <AppText style={goal == null && !editing ? quiet : link}>{t("history_all")}</AppText>
      </Pressable>
    </StageCard>
  );
}

function Step({ label, disabled, onPress, children }: { label: string; disabled: boolean; onPress: () => void; children: React.ReactNode }) {
  const look = useStageLook();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled}
      onPress={() => { haptics.selection(); onPress(); }}
      style={[styles.step, { borderColor: look.glassBorder, opacity: disabled ? 0.4 : 1 }]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  icon: { width: 44, height: 44, margin: -10, alignItems: "center", justifyContent: "center" },
  figure: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  big: { fontSize: 36, lineHeight: 40, fontWeight: "900" },
  track: { height: 12, borderRadius: 6, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 6 },
  lines: { gap: 2 },
  reached: { flexDirection: "row", alignItems: "center", gap: 6 },
  link: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  historyLink: { marginTop: -8, marginBottom: -8 },
  editor: { gap: 12 },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
  step: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  draft: { minWidth: 96, textAlign: "center", fontSize: 24, fontWeight: "900" },
  links: { flexDirection: "row", justifyContent: "center", gap: 18 },
});
