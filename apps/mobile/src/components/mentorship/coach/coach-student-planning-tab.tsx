import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  formatWeekRangeLabel,
  formatWeekdayShort,
  shiftDate,
  todayIso,
  weekDates,
  weekStart,
} from "@mentor/core";
import type { MentorshipProgramTemplateDto, MentorshipStudentReportDto } from "@mentor/types";
import {
  MENTORSHIP_ASSIGNMENT_MAX_DAYS_AHEAD,
  MENTORSHIP_ASSIGNMENT_MAX_TASKS,
  MENTORSHIP_COACH_NOTE_MAX,
  mentorshipAssignmentTaskSchema,
} from "@mentor/validation";
import { fetchExamTaxonomy } from "../../../lib/analysis-api.js";
import { haptics } from "../../../lib/haptics.js";
import {
  assignStudentTasks,
  deleteTemplate,
  fetchTemplates,
  saveTemplate,
  suggestAssignments,
} from "../../../lib/mentorship-api.js";
import { fetchPlanningTasks } from "../../../lib/mentorship-plan-api.js";
import {
  buildTemplateDrafts,
  extractMentorshipError,
  toTemplateTasks,
  type DatedAssignmentDraft,
} from "../../../lib/mentorship-view.js";
import { newRequestId } from "../../../lib/request-id.js";
import { useLocale, useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { useToast } from "../../../providers/toast-provider.js";
import { PanelCard, PanelCardTitle } from "../../panel/primitives.js";
import { AppText, Button, Chip, TextField } from "../../ui/index.js";
import { PlanningTemplateSheets } from "./coach-student-planning-sheets.js";

interface KeyedDraft extends DatedAssignmentDraft {
  key: string;
}

export function CoachStudentPlanningTab({
  report,
}: {
  report: MentorshipStudentReportDto;
}) {
  const t = useTranslations("students");
  const tCommon = useTranslations("common");
  const { locale } = useLocale();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { palette, radii, space } = useThemeTokens();

  const today = todayIso();
  const maxDate = shiftDate(today, MENTORSHIP_ASSIGNMENT_MAX_DAYS_AHEAD);
  const [anchorWeek, setAnchorWeek] = useState(() => weekStart(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [coachNote, setCoachNote] = useState("");
  const [drafts, setDrafts] = useState<KeyedDraft[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [saveTplOpen, setSaveTplOpen] = useState(false);
  const [loadTplOpen, setLoadTplOpen] = useState(false);

  const days = useMemo(() => weekDates(anchorWeek), [anchorWeek]);

  const tasksQuery = useQuery({
    queryKey: ["mentorship-planning-tasks", report.studentId, anchorWeek],
    queryFn: () => fetchPlanningTasks(report.studentId, anchorWeek, shiftDate(anchorWeek, 6)),
  });

  const taxonomyQuery = useQuery({
    queryKey: ["exam-taxonomy", report.studentExamType],
    queryFn: () => fetchExamTaxonomy(report.studentExamType!),
    enabled: Boolean(report.studentExamType),
  });

  const templatesQuery = useQuery({
    queryKey: ["mentorship-templates"],
    queryFn: fetchTemplates,
  });

  const subjects = taxonomyQuery.data?.subjects ?? [];
  const selectedSubjectSlug =
    subjects.find((s) => s.name === subject)?.slug ?? null;
  const topics = useMemo(
    () =>
      selectedSubjectSlug
        ? (taxonomyQuery.data?.topics ?? []).filter(
            (tp) => tp.subjectSlug === selectedSubjectSlug,
          )
        : [],
    [taxonomyQuery.data?.topics, selectedSubjectSlug],
  );

  const addDraftValid =
    drafts.length < MENTORSHIP_ASSIGNMENT_MAX_TASKS &&
    selectedDate >= today &&
    selectedDate <= maxDate &&
    mentorshipAssignmentTaskSchema.safeParse({
      title: title.trim(),
      taskDate: selectedDate,
      subject,
      topic: subject ? topic : null,
      coachNote: coachNote.trim() || null,
    }).success;

  function commitDraft() {
    if (!addDraftValid && editingKey === null) return;
    const item: KeyedDraft = {
      key: editingKey ?? newRequestId(),
      title: title.trim(),
      taskDate: selectedDate,
      subject,
      topic: subject ? topic : null,
      coachNote: coachNote.trim() || null,
    };
    setDrafts((cur) =>
      editingKey ? cur.map((d) => (d.key === editingKey ? item : d)) : [...cur, item],
    );
    setEditingKey(null);
    setTitle("");
    setSubject(null);
    setTopic(null);
    setCoachNote("");
  }

  function startEditDraft(draft: KeyedDraft) {
    setEditingKey(draft.key);
    setSelectedDate(draft.taskDate);
    setAnchorWeek(weekStart(draft.taskDate));
    setTitle(draft.title);
    setSubject(draft.subject);
    setTopic(draft.topic);
    setCoachNote(draft.coachNote ?? "");
  }

  const assignMutation = useMutation({
    mutationFn: () =>
      assignStudentTasks(
        report.studentId,
        drafts.map(({ title: tl, taskDate, subject: sub, topic: tp, coachNote: cn }) => ({
          title: tl,
          taskDate,
          subject: sub,
          topic: tp,
          coachNote: cn,
        })),
      ),
    onSuccess: async () => {
      void haptics.success();
      const count = drafts.length;
      setDrafts([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mentorship-planning-tasks", report.studentId] }),
        queryClient.invalidateQueries({ queryKey: ["mentorship-report", report.studentId] }),
      ]);
      toast.show(t("assign_done_body", { name: report.studentDisplayName, count }));
    },
    onError: (err) => {
      void haptics.error();
      toast.show(extractMentorshipError(err, tCommon("error_body")));
    },
  });

  const suggestMutation = useMutation({
    mutationFn: () => suggestAssignments(report.studentId),
    onSuccess: (res) => {
      void haptics.success();
      const loaded = buildTemplateDrafts(
        { examType: report.studentExamType, tasks: res.tasks },
        anchorWeek,
        report.studentExamType,
        MENTORSHIP_ASSIGNMENT_MAX_TASKS - drafts.length,
        { minDate: today, maxDate },
      );
      if (loaded.drafts.length === 0) {
        toast.show(t("planning_capacity", { max: MENTORSHIP_ASSIGNMENT_MAX_TASKS }));
        return;
      }
      setDrafts((cur) => [
        ...cur,
        ...loaded.drafts.map((d) => ({ ...d, key: newRequestId() })),
      ]);
      toast.show(t("suggestions_added", { count: loaded.drafts.length }));
    },
    onError: (err) => {
      void haptics.error();
      toast.show(extractMentorshipError(err, tCommon("error_body")));
    },
  });

  const saveTplMutation = useMutation({
    mutationFn: (name: string) =>
      saveTemplate({
        name,
        examType: report.studentExamType,
        tasks: toTemplateTasks(drafts),
      }),
    onSuccess: (saved) => {
      void haptics.success();
      setSaveTplOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["mentorship-templates"] });
      toast.show(t("template_saved", { name: saved.name }));
    },
    onError: (err) => {
      void haptics.error();
      toast.show(extractMentorshipError(err, tCommon("error_body")));
    },
  });

  const deleteTplMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      void haptics.success();
      void queryClient.invalidateQueries({ queryKey: ["mentorship-templates"] });
    },
    onError: (err) => toast.show(extractMentorshipError(err, tCommon("error_body"))),
  });

  function applyTemplate(tpl: MentorshipProgramTemplateDto) {
    const loaded = buildTemplateDrafts(
      tpl,
      anchorWeek,
      report.studentExamType,
      MENTORSHIP_ASSIGNMENT_MAX_TASKS - drafts.length,
      { minDate: today, maxDate },
    );
    setDrafts((cur) => [
      ...cur,
      ...loaded.drafts.map((d) => ({ ...d, key: newRequestId() })),
    ]);
    if (loaded.clearedTopics > 0) {
      toast.show(t("template_topics_cleared", { count: loaded.clearedTopics }));
    } else {
      toast.show(t("template_loaded", { name: tpl.name }));
    }
  }

  const dayTasks = (tasksQuery.data ?? []).filter((item) => item.taskDate === selectedDate);

  return (
    <View style={{ gap: space.md }}>
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
              setSelectedDate(prev < today ? today : prev);
            }}
            style={{ flex: 1 }}
          />
          <Button
            label={t("pager_next")}
            variant="secondary"
            onPress={() => {
              const next = shiftDate(anchorWeek, 7);
              setAnchorWeek(next);
              setSelectedDate(next > maxDate ? maxDate : next);
            }}
            style={{ flex: 1 }}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStrip}>
          {days.map((iso) => {
            const disabled = iso < today || iso > maxDate;
            const count = (tasksQuery.data ?? []).filter((x) => x.taskDate === iso).length;
            const dCount = drafts.filter((x) => x.taskDate === iso).length;
            return (
              <Chip
                key={iso}
                label={`${formatWeekdayShort(iso, locale)} ${iso.slice(8)}${count || dCount ? ` (${count + dCount})` : ""}`}
                selected={selectedDate === iso}
                tone={disabled ? "default" : "coach"}
                onPress={disabled ? undefined : () => setSelectedDate(iso)}
              />
            );
          })}
        </ScrollView>

        {dayTasks.length > 0 ? (
          <View style={{ gap: 4 }}>
            <AppText variant="caption" tone="secondary">
              {t("planning_existing")}
            </AppText>
            {dayTasks.map((task) => (
              <AppText key={task.id} variant="caption">
                • {task.title} {task.subject ? `(${task.subject})` : ""}
              </AppText>
            ))}
          </View>
        ) : null}
      </PanelCard>

      <PanelCard style={{ gap: space.sm }}>
        <PanelCardTitle>
          {editingKey ? t("planning_edit_task") : t("assign_homework_title")}
        </PanelCardTitle>
        <TextField
          label={t("homework_title_label")}
          value={title}
          onChangeText={setTitle}
          placeholder={t("homework_title_placeholder")}
          maxLength={200}
        />

        {subjects.length > 0 ? (
          <View style={{ gap: 6 }}>
            <AppText variant="caption" tone="secondary">
              {t("homework_subject_label")}
            </AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStrip}>
              <Chip
                label={t("assign_subject_none")}
                selected={subject === null}
                onPress={() => {
                  setSubject(null);
                  setTopic(null);
                }}
              />
              {subjects.map((sub) => (
                <Chip
                  key={sub.slug}
                  label={sub.name}
                  selected={subject === sub.name}
                  onPress={() => {
                    setSubject(sub.name);
                    setTopic(null);
                  }}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {topics.length > 0 ? (
          <View style={{ gap: 6 }}>
            <AppText variant="caption" tone="secondary">
              {t("assign_topic")}
            </AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStrip}>
              <Chip
                label={t("assign_topic_none")}
                selected={topic === null}
                onPress={() => setTopic(null)}
              />
              {topics.slice(0, 24).map((tp) => (
                <Chip
                  key={tp.slug}
                  label={tp.name}
                  selected={topic === tp.name}
                  onPress={() => setTopic(tp.name)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <TextField
          label={t("homework_note_label")}
          value={coachNote}
          onChangeText={setCoachNote}
          placeholder={t("homework_note_placeholder")}
          maxLength={MENTORSHIP_COACH_NOTE_MAX}
        />

        <View style={styles.btnRow}>
          <Button
            label={editingKey ? t("planning_save_change") : t("planning_add_draft")}
            variant="secondary"
            disabled={!addDraftValid}
            onPress={commitDraft}
            style={{ flex: 1 }}
          />
          {editingKey ? (
            <Button
              label={t("cancel_preview_cta")}
              variant="secondary"
              onPress={() => {
                setEditingKey(null);
                setTitle("");
                setSubject(null);
                setTopic(null);
                setCoachNote("");
              }}
              style={{ flex: 1 }}
            />
          ) : null}
        </View>

        <View style={styles.btnRow}>
          <Button
            label={t("template_load")}
            variant="secondary"
            onPress={() => setLoadTplOpen(true)}
            style={styles.wideActionBtn}
          />
          <Button
            label={t("ai_suggest_week_cta")}
            variant="secondary"
            loading={suggestMutation.isPending}
            onPress={() => suggestMutation.mutate()}
            style={styles.wideActionBtn}
          />
        </View>
      </PanelCard>

      {drafts.length > 0 ? (
        <PanelCard style={{ gap: space.sm }}>
          <PanelCardTitle>
            {t("planning_drafts_title", { count: drafts.length })}
          </PanelCardTitle>
          {drafts.map((d) => (
            <View
              key={d.key}
              style={[
                styles.draftRow,
                {
                  backgroundColor: palette.surfaceAlt,
                  borderRadius: radii.inner,
                },
              ]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="cardTitle">{d.title}</AppText>
                <AppText variant="micro" tone="secondary">
                  {d.taskDate}
                  {d.subject ? ` · ${d.subject}` : ""}
                  {d.topic ? ` / ${d.topic}` : ""}
                </AppText>
              </View>
              <Chip label={t("planning_edit")} onPress={() => startEditDraft(d)} />
              <Chip
                label={t("assign_remove")}
                onPress={() => setDrafts((cur) => cur.filter((x) => x.key !== d.key))}
              />
            </View>
          ))}
          <Button
            label={t("template_save")}
            variant="secondary"
            disabled={assignMutation.isPending}
            onPress={() => setSaveTplOpen(true)}
          />
          <Button
            label={t("assign_action", { count: drafts.length })}
            loading={assignMutation.isPending}
            onPress={() => assignMutation.mutate()}
          />
        </PanelCard>
      ) : null}

      <PlanningTemplateSheets
        saveVisible={saveTplOpen}
        loadVisible={loadTplOpen}
        templates={templatesQuery.data ?? []}
        busy={saveTplMutation.isPending || deleteTplMutation.isPending}
        onCloseSave={() => setSaveTplOpen(false)}
        onCloseLoad={() => setLoadTplOpen(false)}
        onSaveTemplate={(name) => saveTplMutation.mutate(name)}
        onLoadTemplate={applyTemplate}
        onDeleteTemplate={(id) => deleteTplMutation.mutate(id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  weekBar: { flexDirection: "row", alignItems: "center", gap: 8 },
  dayStrip: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  btnRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  wideActionBtn: { flexGrow: 1, minWidth: 190 },
  draftRow: {
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
