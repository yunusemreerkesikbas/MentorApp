import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon } from "@solar-icons/react-native/bold/check";
import { ClockCircleIcon } from "@solar-icons/react-native/linear/clock-circle";
import {
  endTimeAfterStart,
  planTaskCreateInput,
  planTaskDraftError,
  planTaskFormValues,
  planTaskLockedFocus,
  planTaskUpdateInput,
  plusOneHour,
  type PlanTaskDraft,
  type PlanTaskDraftError,
} from "@mentor/core";
import type { PlanTaskDto } from "@mentor/types";
import { fetchExamTaxonomy } from "../../lib/analysis-api.js";
import { createPlanTask, updatePlanTask } from "../../lib/coaching-api.js";
import { haptics } from "../../lib/haptics.js";
import { mixHex } from "../../lib/layout.js";
import { errorText } from "../../lib/plan-view.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { FormSheet } from "../panel/primitives.js";
import { Button } from "../ui/button.js";
import { AppText } from "../ui/text.js";
import { TextField } from "../ui/text-field.js";
import { PlanTimeSheet } from "./plan-time-sheet.js";

export type PlanFormMode = { kind: "add"; date: string } | { kind: "edit"; task: PlanTaskDto };

/** "Yeni görev" / "Görevi düzenle": the web's `PlanAddTaskForm` in the titled sheet. */
export function PlanTaskFormSheet({
  mode,
  onClose,
  onSaved,
}: {
  mode: PlanFormMode | null;
  onClose: () => void;
  onSaved: (task: PlanTaskDto) => void;
}) {
  if (!mode) return null;
  // A fresh form per open: the draft starts from the mode.
  const key = mode.kind === "edit" ? `edit-${mode.task.id}` : `add-${mode.date}`;
  return <TaskForm key={key} mode={mode} onClose={onClose} onSaved={onSaved} />;
}

function initialDraft(mode: PlanFormMode): PlanTaskDraft {
  if (mode.kind === "add") {
    return {
      title: "",
      subject: "",
      allDay: true,
      startTime: "09:00",
      endTime: "10:00",
      description: "",
      duration: "",
    };
  }
  const { task } = mode;
  return {
    title: task.title,
    subject: task.subject ?? "",
    allDay: !task.startTime,
    startTime: task.startTime ?? "09:00",
    endTime: task.endTime ?? plusOneHour(task.startTime ?? "09:00"),
    description: task.description ?? "",
    duration: task.durationMinutes?.toString() ?? "",
  };
}

function TaskForm({
  mode,
  onClose,
  onSaved,
}: {
  mode: PlanFormMode;
  onClose: () => void;
  onSaved: (task: PlanTaskDto) => void;
}) {
  const { palette, radii } = useThemeTokens();
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  const [draft, setDraft] = useState(() => initialDraft(mode));
  const [error, setError] = useState<PlanTaskDraftError | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // State re-renders the button; the ref closes the gap before that render, so a double tap on
  // "Görev ekle" cannot create the task twice.
  const savingRef = useRef(false);
  const [timeTarget, setTimeTarget] = useState<"start" | "end" | null>(null);
  const locked = mode.kind === "edit" ? planTaskLockedFocus(mode.task) : null;

  const change = (patch: Partial<PlanTaskDraft>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
    setError(null);
    setServerError(null);
  };

  const submit = async () => {
    if (savingRef.current) return;
    const problem = planTaskDraftError(draft);
    if (problem) {
      haptics.error();
      setError(problem);
      return;
    }
    const values = planTaskFormValues(draft);
    savingRef.current = true;
    setSaving(true);
    try {
      const saved =
        mode.kind === "add"
          ? await createPlanTask(planTaskCreateInput(values, mode.date))
          : await updatePlanTask(mode.task.id, planTaskUpdateInput(values, mode.task));
      onSaved(saved);
    } catch (failure) {
      setServerError(errorText(failure, tCommon("error_body")));
      savingRef.current = false;
      setSaving(false);
    }
  };

  const message = serverError ?? (error ? t(error) : null);

  return (
    <FormSheet
      visible
      title={mode.kind === "add" ? t("add_sheet_title") : t("edit_sheet_title")}
      closeLabel={tCommon("close")}
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          {message ? (
            <AppText tone="danger" accessibilityLiveRegion="polite" style={styles.error}>
              {message}
            </AppText>
          ) : null}
          <Button
            label={mode.kind === "add" ? t("add_task") : t("edit_task_save")}
            loading={saving}
            onPress={() => void submit()}
          />
        </View>
      }
    >
      <TextField
        label={t("new_task")}
        value={draft.title}
        onChangeText={(title) => change({ title })}
        placeholder={t("task_placeholder")}
        maxLength={200}
        returnKeyType="done"
      />

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: draft.allDay }}
        onPress={() => {
          haptics.selection();
          change({ allDay: !draft.allDay });
        }}
        style={styles.allDay}
      >
        <View
          style={[
            styles.checkBox,
            {
              borderColor: draft.allDay ? palette.progress : palette.secondary,
              backgroundColor: draft.allDay ? palette.progress : "transparent",
            },
          ]}
        >
          {draft.allDay ? <CheckIcon size={16} color="#FFFFFF" /> : null}
        </View>
        <AppText style={styles.allDayLabel}>{t("all_day")}</AppText>
      </Pressable>

      {draft.allDay ? null : (
        <View style={styles.times}>
          <TimeField
            label={t("time_start")}
            value={draft.startTime}
            onPress={() => setTimeTarget("start")}
          />
          <TimeField
            label={t("time_end")}
            value={draft.endTime}
            onPress={() => setTimeTarget("end")}
          />
        </View>
      )}

      {locked ? (
        // An analysis or weekly-report task keeps its subject (the web's locked box): the API
        // refuses an analysis subject change with 409, and a weekly-report pick would be dropped.
        <View
          accessible
          accessibilityLabel={`${t("analysis_focus_locked")}, ${locked.subject ?? t("weekly_report_rhythm")}`}
          style={[
            styles.locked,
            {
              borderColor: palette.border,
              borderRadius: radii.card,
              backgroundColor: mixHex(palette.secondary, palette.surface, 0.12),
            },
          ]}
        >
          <AppText tone="secondary" style={styles.lockedLabel}>
            {t("analysis_focus_locked")}
          </AppText>
          <AppText style={styles.lockedValue}>
            {locked.subject ?? t("weekly_report_rhythm")}
            {locked.topic ? ` · ${locked.topic}` : ""}
          </AppText>
        </View>
      ) : (
        <SubjectField value={draft.subject} onChange={(subject) => change({ subject })} />
      )}

      <TextField
        label={t("duration_label")}
        value={draft.duration}
        onChangeText={(duration) => change({ duration: duration.replace(/[^0-9]/g, "") })}
        placeholder={t("duration_optional")}
        keyboardType="number-pad"
        maxLength={3}
      />

      <TextField
        label={t("description")}
        value={draft.description}
        onChangeText={(description) => change({ description })}
        placeholder={t("description_placeholder")}
        multiline
        maxLength={2000}
        style={styles.description}
      />

      <PlanTimeSheet
        value={
          timeTarget === "start" ? draft.startTime : timeTarget === "end" ? draft.endTime : null
        }
        title={t("time_picker_title")}
        onPick={(hm) =>
          change(
            timeTarget === "start"
              ? { startTime: hm, endTime: endTimeAfterStart(hm, draft.endTime) }
              : { endTime: hm },
          )
        }
        onClose={() => setTimeTarget(null)}
      />
    </FormSheet>
  );
}

function TimeField({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  const { palette, radii } = useThemeTokens();
  return (
    <View style={styles.timeField}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value}`}
        onPress={onPress}
        style={[
          styles.timeBox,
          {
            borderColor: palette.border,
            borderRadius: radii.inner,
            backgroundColor: palette.surface,
          },
        ]}
      >
        <AppText tabularNums style={styles.timeText}>
          {value}
        </AppText>
        <ClockCircleIcon size={22} color={palette.main} />
      </Pressable>
    </View>
  );
}

/** Taxonomy chips for the student's exam; free text without a taxonomy (the web's `SubjectPicker`). */
function SubjectField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const { palette } = useThemeTokens();
  const t = useTranslations("plan");
  const { user } = useAuth();
  const examType = user?.examType ?? null;
  const examVariant = user?.examVariant ?? null;
  const taxonomy = useQuery({
    queryKey: ["exam-taxonomy", examType, examVariant],
    queryFn: () => fetchExamTaxonomy(examType!, examVariant),
    enabled: examType !== null,
  });

  const freeText = (
    <TextField
      label={t("subject")}
      value={value}
      onChangeText={onChange}
      placeholder={t("subject_placeholder")}
      maxLength={80}
    />
  );

  if (examType === null) {
    return (
      <View style={styles.subject}>
        <AppText tone="secondary">{t("subject_pick_hint")}</AppText>
        {freeText}
      </View>
    );
  }
  if (taxonomy.isPending) {
    return (
      <View style={styles.subject}>
        <AppText style={styles.subjectLabel}>{t("subject_pick_label")}</AppText>
        <AppText tone="secondary">{t("loading")}</AppText>
      </View>
    );
  }
  const subjects = taxonomy.data?.subjects ?? [];
  if (subjects.length === 0) return freeText;

  return (
    <View style={styles.subject}>
      <AppText style={styles.subjectLabel}>{t("subject_pick_label")}</AppText>
      <View style={styles.chips}>
        {subjects.map((subject) => {
          const selected = value === subject.name;
          return (
            <Pressable
              key={subject.slug}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                haptics.selection();
                onChange(selected ? "" : subject.name);
              }}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? palette.ctaPlayBg : palette.surface,
                  borderColor: selected ? palette.ctaPlayBg : palette.border,
                },
              ]}
            >
              <AppText
                // One line, always: at a fractional density (2.625) the measured width rounds a pixel
                // short, so a wrapped row broke "TYT Fizik" in two and clipped "AYT Edebiyat" to "AYT".
                numberOfLines={1}
                style={[styles.chipText, { color: selected ? "#FFFFFF" : palette.main }]}
              >
                {subject.name}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    gap: 8,
  },
  error: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  allDay: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    alignSelf: "flex-start",
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  allDayLabel: {
    fontSize: 16,
    lineHeight: 22,
  },
  times: {
    flexDirection: "row",
    gap: 12,
  },
  timeField: {
    flex: 1,
    gap: 4,
  },
  timeBox: {
    minHeight: 52,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeText: {
    fontSize: 16,
    lineHeight: 22,
  },
  subject: {
    gap: 8,
  },
  locked: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  lockedLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  lockedValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  subjectLabel: {
    fontSize: 15,
    lineHeight: 20,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
  },
  chipText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  description: {
    minHeight: 88,
    paddingTop: 12,
    textAlignVertical: "top",
  },
});
