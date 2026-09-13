"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslations } from "next-intl";
import type { MentorshipProgramTemplateDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button } from "@mentor/ui";
import {
  CoachTextField,
  NOTE_CLASS,
  SUBHEAD_CLASS,
  TextButton,
} from "@/components/mentorship/coach-ui";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import {
  deleteTemplate,
  fetchTemplates,
  saveTemplate,
  suggestAssignments,
} from "@/lib/mentorship";
import { ComposerSelect } from "./composer-select";
import { toTemplateTasks, type DatedDraft } from "./template-apply";

/**
 * Save / load / delete for the composer's saved programs, plus the AI suggestion that arrives
 * through the same door.
 *
 * Split into pieces because the planner shows them in two places: loading and the suggestion open
 * the panel ("Hızlı başlangıç"), saving closes it, once there is a week worth keeping. The list
 * lives in `useProgramTemplates` so both ends read the same rows.
 *
 * Loading fills the composer client-side — there is no server-side "apply" — so the coach sees
 * exactly what will be written and the subject/topic picker stays the only real gate on a program
 * built against another exam's taxonomy.
 */
export function useProgramTemplates() {
  const [templates, setTemplates] = useState<MentorshipProgramTemplateDto[]>([]);
  useEffect(() => {
    let active = true;
    fetchTemplates()
      .then((rows) => {
        if (active) setTemplates(rows);
      })
      .catch(() => {
        /* The composer is the screen; a missing template list must never block assigning. */
      });
    return () => {
      active = false;
    };
  }, []);
  return [templates, setTemplates] as const;
}

function useShowError() {
  const common = useTranslations("common");
  const toast = useMentorToast();
  return (err: unknown) =>
    toast.error({
      title: common("error_title"),
      message: err instanceof ApiClientError ? err.message : common("error_unknown"),
    });
}

export function TemplateLoadSelect({
  templates,
  disabled,
  onLoad,
}: {
  templates: readonly MentorshipProgramTemplateDto[];
  disabled: boolean;
  onLoad: (template: MentorshipProgramTemplateDto) => void;
}) {
  const t = useTranslations("mentorship");
  return (
    <ComposerSelect
      label={t("template_load")}
      value=""
      placeholder={templates.length === 0 ? t("template_none") : t("template_load_placeholder")}
      options={templates.map((row) => ({
        value: row.id,
        label: t("template_option", { name: row.name, count: row.tasks.length }),
      }))}
      disabled={disabled || templates.length === 0}
      onChange={(id) => {
        const template = templates.find((row) => row.id === id);
        if (template) onLoad(template);
      }}
    />
  );
}

/**
 * The model drafts a week; it arrives through the SAME door a saved program does.
 *
 * `onLoad` takes a template, and a suggestion is exactly that shape, so nothing new drafts
 * anything: the tasks land in the composer, the coach edits them, and `POST .../assignments` is
 * still the only path onto a student's plan. `examType: null` marks it as belonging to no exam,
 * which is honest — the model was never given a taxonomy, and every `topic` it returns is null.
 */
export function SuggestButton({
  studentId,
  disabled,
  onLoad,
}: {
  studentId: string;
  disabled: boolean;
  onLoad: (template: MentorshipProgramTemplateDto) => void;
}) {
  const t = useTranslations("mentorship");
  const toast = useMentorToast();
  const showError = useShowError();
  const [suggesting, setSuggesting] = useState(false);

  async function suggest() {
    setSuggesting(true);
    try {
      const { tasks } = await suggestAssignments(studentId);
      if (tasks.length === 0) {
        toast.info({ title: t("suggest_empty") });
        return;
      }
      onLoad({
        id: `ai-${Date.now()}`,
        name: t("suggest_name"),
        examType: null,
        tasks,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      showError(err);
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <Button
      type="button"
      variant="soft"
      size="sm"
      // Full width stacks cleanly on a phone; in the quick-start grid's auto column it is still
      // only as wide as its label.
      fullWidth
      className="min-h-11"
      busy={suggesting}
      disabled={disabled}
      onClick={suggest}
    >
      {t("suggest_action")}
    </Button>
  );
}

export function TemplateSaveRow({
  templates,
  setTemplates,
  drafts,
  examType,
  disabled,
}: {
  templates: readonly MentorshipProgramTemplateDto[];
  setTemplates: Dispatch<SetStateAction<MentorshipProgramTemplateDto[]>>;
  drafts: readonly DatedDraft[];
  /** The STUDENT's exam: what a template saved from this composer was built against. */
  examType: string | null;
  disabled: boolean;
}) {
  const t = useTranslations("mentorship");
  const toast = useMentorToast();
  const dialog = useMentorDialog();
  const showError = useShowError();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (trimmed === "" || drafts.length === 0) return;
    // Saving over a name replaces the row — that IS the edit path, so it is worth one confirm.
    if (
      templates.some((row) => row.name === trimmed) &&
      !(await dialog.confirm({
        title: t("template_overwrite_title"),
        message: t("template_overwrite_body", { name: trimmed }),
        confirmLabel: t("template_save"),
        cancelLabel: t("confirm_cancel"),
      }))
    ) {
      return;
    }
    setBusy(true);
    try {
      const saved = await saveTemplate({ name: trimmed, examType, tasks: toTemplateTasks(drafts) });
      setTemplates((prev) => [saved, ...prev.filter((row) => row.id !== saved.id)]);
      setName("");
      toast.success({ title: t("template_saved", { name: saved.name }) });
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function remove(template: MentorshipProgramTemplateDto) {
    const confirmed = await dialog.confirm({
      title: t("template_delete_title"),
      message: t("template_delete_body", { name: template.name }),
      confirmLabel: t("template_delete_action"),
      cancelLabel: t("confirm_cancel"),
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await deleteTemplate(template.id);
      setTemplates((prev) => prev.filter((row) => row.id !== template.id));
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  const named = templates.find((row) => row.name === name.trim());

  return (
    <section className="flex flex-col gap-2">
      <h3 className={SUBHEAD_CLASS}>{t("template_save_title")}</h3>
      <div className="flex flex-wrap items-end gap-2">
        <CoachTextField
          label={t("template_name")}
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          className="min-w-48 flex-1"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-11"
          busy={busy}
          disabled={disabled || drafts.length === 0 || name.trim() === ""}
          onClick={save}
        >
          {t("template_save")}
        </Button>
        {named ? (
          <TextButton tone="danger" disabled={busy} onClick={() => remove(named)}>
            {t("template_delete_action")}
          </TextButton>
        ) : null}
      </div>
      <p className={NOTE_CLASS}>{t("template_hint")}</p>
    </section>
  );
}
