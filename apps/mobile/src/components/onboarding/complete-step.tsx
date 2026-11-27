import { useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackpackIcon } from "@solar-icons/react-native/linear/backpack";
import { BellIcon } from "@solar-icons/react-native/linear/bell";
import { Buildings2Icon } from "@solar-icons/react-native/linear/buildings-2";
import { CalendarIcon } from "@solar-icons/react-native/linear/calendar";
import { SquareAcademicCapIcon } from "@solar-icons/react-native/linear/square-academic-cap";
import { StopwatchIcon } from "@solar-icons/react-native/linear/stopwatch";
import { TargetIcon } from "@solar-icons/react-native/linear/target";
import { availableAppDestination, homePathForUser, type OnboardingAudience } from "@mentor/core";
import type { AuthUser, CareerGroup } from "@mentor/types";
import { haptics } from "../../lib/haptics.js";
import { readySummaryRows, type ReadyRow } from "../../lib/onboarding-summary.js";
import { useAppAvailability } from "../../providers/availability-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button } from "../ui/index.js";
import { PlayIconWell, type PlayWell } from "../onboarding-play/index.js";
import { ReadyWindow } from "./ready-window.js";

export interface ReadySummary {
  dailyGoalMinutes: number | null;
  careerGroup: CareerGroup | null;
  /** True only when the daily-goal step registered this device for reminders. */
  reminder: boolean;
}

/** "Yolun hazır": what they chose and where the countdown lives, then a one-way door to the panel. */
export function CompleteStep({
  user, audience, summary, onFinish,
}: {
  user: AuthUser;
  audience: OnboardingAudience;
  summary: ReadySummary;
  onFinish: (destination: string) => void;
}) {
  const t = useTranslations("play");
  const tOnboarding = useTranslations("onboarding");
  const { availability } = useAppAvailability();
  const { palette, space, radii } = useThemeTokens();
  const insets = useSafeAreaInsets();
  const leaving = useRef(false);
  const destination = availableAppDestination(homePathForUser(user), user, availability) ?? homePathForUser(user);

  const rows = readySummaryRows({
    role: audience,
    examType: user.examType,
    examVariant: user.examVariant,
    dailyGoalMinutes: summary.dailyGoalMinutes,
    careerGroup: summary.careerGroup,
    reminder: summary.reminder,
  });

  const look = (row: ReadyRow): { Icon: typeof BellIcon; well: PlayWell; title: string; sub?: string } => {
    switch (row.kind) {
      case "exam": {
        const level = row.examType === "KPSS" && row.examVariant ? ` · ${tOnboarding(`kpss_variant_${row.examVariant}`)}` : "";
        const Icon = row.examType === "KPSS" ? Buildings2Icon : row.examType === "LGS" ? BackpackIcon : SquareAcademicCapIcon;
        return { Icon, well: "blue", title: `${row.examType}${level}` };
      }
      case "goal":
        return { Icon: StopwatchIcon, well: "peri", title: t("complete_summary_goal", { minutes: row.minutes }) };
      case "field":
        return { Icon: TargetIcon, well: "coral", title: t("complete_summary_field", { field: tOnboarding(`field_group_${row.careerGroup}`) }) };
      case "reminder":
        return { Icon: BellIcon, well: "violet", title: t("complete_summary_reminder") };
      case "countdown":
        return { Icon: CalendarIcon, well: "blue", title: t("complete_countdown_title"), sub: t("complete_countdown_source") };
    }
  };

  const finish = () => {
    if (leaving.current) return;
    leaving.current = true;
    haptics.success();
    onFinish(destination);
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space["3xl"], paddingHorizontal: space.xl, gap: space.lg }]}>
        {/* Coaches get no field, so the window holds Puhu's default pose. */}
        <ReadyWindow career={audience === "coach" ? null : summary.careerGroup} />
        <View style={{ alignItems: "center", gap: space.sm }}>
          <AppText accessibilityRole="header" style={styles.title}>
            {audience === "coach" ? t("complete_title_coach") : t("complete_title")}
          </AppText>
          <AppText style={styles.body}>
            {audience === "coach" ? t("complete_invite_code_coach") : t("complete_subtitle")}
          </AppText>
        </View>
        {rows.length ? (
          <View
            accessibilityLabel={t("complete_summary_label")}
            style={[styles.list, { borderRadius: radii.button, borderColor: palette.playLine, backgroundColor: palette.surface }]}
          >
            {rows.map((row, index) => {
              const { Icon, well, title, sub } = look(row);
              return (
                <View key={row.kind} style={[styles.row, index > 0 && { borderTopWidth: 2, borderTopColor: palette.playLine }]}>
                  <PlayIconWell well={well} size={36}><Icon size={18} color={palette.main} /></PlayIconWell>
                  <View style={styles.rowText}>
                    <AppText style={styles.rowTitle}>{title}</AppText>
                    {sub ? <AppText tone="secondary" style={styles.rowSub}>{sub}</AppText> : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
      <View style={{ paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: Math.max(insets.bottom, space.lg) + space.sm }}>
        <Button label={t("complete_go_panel")} onPress={finish} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { alignItems: "center", paddingBottom: 24 },
  title: { fontSize: 32, lineHeight: 38, fontWeight: "800", textAlign: "center" },
  body: { maxWidth: 304, fontSize: 16, lineHeight: 24, fontWeight: "500", textAlign: "center" },
  list: { alignSelf: "stretch", borderWidth: 2, paddingHorizontal: 16, paddingVertical: 4 },
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, lineHeight: 22, fontWeight: "700" },
  rowSub: { fontSize: 14, fontWeight: "500" },
});
