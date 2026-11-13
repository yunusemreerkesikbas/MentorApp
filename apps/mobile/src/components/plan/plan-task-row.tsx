import { Pressable, StyleSheet, View } from "react-native";
import { CheckIcon } from "@solar-icons/react-native/bold/check";
import { MenuDotsIcon } from "@solar-icons/react-native/linear/menu-dots";
import { UserRoundedIcon } from "@solar-icons/react-native/linear/user-rounded";
import { isCoachAssigned } from "@mentor/core";
import type { PlanTaskDto } from "@mentor/types";
import { colors, colorsDark } from "@mentor/ui/tokens";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/text.js";

/** The web's `PlanTaskRow` (non-dense): checkbox, title, meta line, coach note, "⋯" menu. */
export function PlanTaskRow({
  task,
  readOnly,
  busy,
  onToggle,
  onOpenMenu,
  onStartSession,
}: {
  task: PlanTaskDto;
  readOnly: boolean;
  busy: boolean;
  onToggle: () => void;
  onOpenMenu: () => void;
  onStartSession: () => void;
}) {
  const { palette } = useThemeTokens();
  const t = useTranslations("plan");
  const done = task.status === "DONE";
  const chipText = palette.mode === "dark" ? colorsDark.chipText : colors.chipText;
  const locked = busy || readOnly;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={task.title}
        accessibilityState={{ checked: done, disabled: locked }}
        disabled={locked}
        onPress={onToggle}
        style={[styles.checkHit, locked && styles.disabled]}
      >
        <View
          style={[
            styles.checkBox,
            {
              borderColor: done ? palette.progress : palette.secondary,
              backgroundColor: done ? palette.progress : "transparent",
            },
          ]}
        >
          {done ? <CheckIcon size={16} color="#FFFFFF" /> : null}
        </View>
      </Pressable>

      <View style={styles.body}>
        <AppText
          style={[
            styles.title,
            done
              ? { color: palette.secondary, textDecorationLine: "line-through", opacity: 0.7 }
              : { color: palette.main },
          ]}
        >
          {task.title}
        </AppText>
        <View style={styles.meta}>
          {task.subject ? (
            // One line, as with the form's chips: at 2.625 density the measured width rounds short and
            // "TYT MATEMATİK" showed as "TYT".
            <AppText numberOfLines={1} style={[styles.subject, { color: chipText }]}>
              {task.subject.toLocaleUpperCase("tr")}
            </AppText>
          ) : null}
          {task.durationMinutes != null ? (
            <AppText tone="secondary" style={styles.metaText}>
              {t("duration_minutes", { minutes: task.durationMinutes })}
            </AppText>
          ) : null}
          {isCoachAssigned(task) ? (
            <View style={styles.coachBadge}>
              <UserRoundedIcon size={12} color={palette.progress} />
              <AppText style={[styles.coachText, { color: palette.progress }]}>
                {t("coach_assigned")}
              </AppText>
            </View>
          ) : null}
          {!done && !readOnly ? (
            <Pressable accessibilityRole="link" hitSlop={12} onPress={onStartSession}>
              <AppText style={[styles.startSession, { color: palette.progress }]}>
                {`${t("start_session")} →`}
              </AppText>
            </Pressable>
          ) : null}
        </View>
        {/* The coach's instruction belongs on the row, not behind a tap (as on the web). */}
        {task.coachNote ? (
          <AppText
            style={[
              styles.note,
              { borderLeftColor: palette.progress, color: done ? palette.secondary : palette.main },
            ]}
          >
            {task.coachNote}
          </AppText>
        ) : null}
      </View>

      {!readOnly ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("task_menu_aria", { title: task.title })}
          disabled={busy}
          onPress={onOpenMenu}
          style={({ pressed }) => [styles.menu, (pressed || busy) && styles.disabled]}
        >
          <MenuDotsIcon size={22} color={palette.secondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  checkHit: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.4,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "500",
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 8,
    rowGap: 2,
    marginTop: 4,
  },
  subject: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  coachBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  coachText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
  },
  startSession: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  note: {
    marginTop: 6,
    paddingLeft: 8,
    borderLeftWidth: 2,
    fontSize: 12,
    lineHeight: 17,
  },
  menu: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
