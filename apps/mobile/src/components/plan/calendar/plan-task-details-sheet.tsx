import { Pressable, StyleSheet, View } from "react-native";
import { ClockCircleIcon } from "@solar-icons/react-native/linear/clock-circle";
import { PenIcon } from "@solar-icons/react-native/linear/pen";
import { TrashBinTrashIcon } from "@solar-icons/react-native/linear/trash-bin-trash";
import { formatDateLabel, formatTimeRange, isCoachAssigned, isPastDate, planEventSwatch } from "@mentor/core";
import type { PlanTaskDto } from "@mentor/types";
import { mixHex } from "../../../lib/layout.js";
import { planEventTint } from "../../../lib/plan-calendar.js";
import { useLocale, useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { FormSheet } from "../../panel/primitives.js";
import { AppText } from "../../ui/text.js";

export function PlanTaskDetailsSheet({
  task,
  visible,
  onDismiss,
  onClose,
  onEdit,
  onDelete,
  deleteDisabled,
}: {
  task: PlanTaskDto | null;
  visible: boolean;
  onDismiss: () => void;
  onClose: () => void;
  onEdit: (task: PlanTaskDto) => void;
  onDelete: (task: PlanTaskDto) => void;
  deleteDisabled: boolean;
}) {
  const { palette, radii } = useThemeTokens();
  const { locale } = useLocale();
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  if (!task) return null;

  const done = task.status === "DONE";
  const when = formatDateLabel(task.taskDate, locale, t("today"), { alwaysFull: true });
  const time = formatTimeRange(task.startTime, task.endTime) ?? t("all_day");
  const subject = [task.subject?.trim(), task.topic?.trim()].filter(Boolean).join(" › ") || "—";
  const tint = planEventTint(planEventSwatch(task.subject), palette);
  const hairline = mixHex(palette.main, palette.surface, 0.08);

  return (
    <FormSheet visible={visible} onDismiss={onDismiss} title={t("event_details_title")} closeLabel={tCommon("close")} onClose={onClose}>
      <View style={[styles.banner, { backgroundColor: tint.bg, borderRadius: radii.card }]}>
        <AppText style={[styles.title, done && styles.done]}>{task.title}</AppText>
        <View style={styles.when}>
          <ClockCircleIcon color={palette.main} size={16} />
          <AppText style={styles.whenText}>{when}, {time}</AppText>
        </View>
      </View>
      <View>
        <DetailRow label={t("subject")} value={subject} />
        <DetailRow label={t("event_status")} value={t(done ? "event_status_done" : "event_status_pending")} border={hairline} />
        {task.durationMinutes != null ? (
          <DetailRow label={t("duration_label")} value={t("duration_minutes", { minutes: task.durationMinutes })} border={hairline} />
        ) : null}
        {task.coachNote ? <DetailRow label={t("coach_note")} value={task.coachNote} border={hairline} multiline /> : null}
        {task.description ? <DetailRow label={t("description")} value={task.description} border={hairline} multiline /> : null}
      </View>
      {!isPastDate(task.taskDate) ? (
        <View style={styles.actions}>
          {!isCoachAssigned(task) ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => onEdit(task)}
              style={[styles.action, { borderColor: mixHex(palette.main, palette.surface, 0.15), borderRadius: radii.button }]}
            >
              <PenIcon size={16} color={palette.main} />
              <AppText style={styles.actionLabel}>{t("task_action_edit")}</AppText>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={deleteDisabled}
            accessibilityState={{ disabled: deleteDisabled }}
            onPress={() => onDelete(task)}
            style={[styles.action, deleteDisabled && styles.disabled, { borderColor: mixHex(palette.danger, palette.surface, 0.3), borderRadius: radii.button }]}
          >
            <TrashBinTrashIcon size={16} color={palette.danger} />
            <AppText style={styles.actionLabel} tone="danger">{t("task_action_delete")}</AppText>
          </Pressable>
        </View>
      ) : null}
    </FormSheet>
  );
}

function DetailRow({ label, value, border, multiline }: {
  label: string;
  value: string;
  border?: string;
  multiline?: boolean;
}) {
  return (
    <View
      style={[
        styles.detailRow,
        multiline && styles.detailStack,
        border ? { borderTopColor: border, borderTopWidth: StyleSheet.hairlineWidth } : null,
      ]}
    >
      <AppText tone="secondary" style={styles.detailLabel}>{label}</AppText>
      <AppText numberOfLines={multiline ? undefined : 1} style={[styles.detailValue, !multiline && styles.alignedValue]}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { padding: 16, gap: 8 },
  title: { fontSize: 18, fontWeight: "700" },
  done: { textDecorationLine: "line-through", opacity: 0.7 },
  when: { flexDirection: "row", alignItems: "center", gap: 8 },
  whenText: { flex: 1, fontSize: 14 },
  detailRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8, paddingVertical: 10 },
  detailStack: { flexDirection: "column", alignItems: "stretch", gap: 4 },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 14, fontWeight: "500" },
  alignedValue: { flex: 1, textAlign: "right" },
  actions: { flexDirection: "row", gap: 8 },
  action: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingHorizontal: 6, minHeight: 44, borderWidth: 1,
  },
  disabled: { opacity: 0.45 },
  actionLabel: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
});
