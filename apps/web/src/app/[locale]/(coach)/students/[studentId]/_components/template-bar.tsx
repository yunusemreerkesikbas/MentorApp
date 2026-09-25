"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MentorshipProgramTemplateDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, TextField } from "@mentor/ui";
import {
  NOTE_CLASS,
  PANEL_LINK_BUTTON,
  PANEL_QUIET_BUTTON,
} from "@/components/mentorship/coach-ui";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import {
  deleteTemplate,
  fetchTemplates,
  saveTemplate,
  suggestAssignments,
} from "@/lib/mentorship";
import { toTemplateTasks, type DatedDraft } from "./template-apply";

/**
 * Save / delete for the composer's saved programs, plus the AI suggestion that arrives through the
 * same door a template does. Loading one is a menu among the planner's sources
 * (`planning-sources.tsx`); saving sits under the program it would save.
 *
 * The list lives in `useProgramTemplates` so both ends read the same rows. Loading fills the
 * composer client-side (there is no server-side "apply"), so the coach sees exactly what will be
 * written and the subject/topic picker stays the only real gate on a program built against another
 * exam's taxonomy.
 */
export function useProgramTemplates() {
  const [templates, setTemplates] = useState<MentorshipProgramTemplateDto[]>(
    [],
  );
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
      message:
        err instanceof ApiClientError ? err.message : common("error_unknown"),
    });
}

/**
 * The model drafts a week; it arrives through the SAME door a saved program does.
 *
 * `onLoad` takes a template, and a suggestion is exactly that shape, so nothing new drafts
 * anything: the tasks land in the composer, the coach edits them, and `POST .../assignments` is
 * still the only path onto a student's plan. `examType: null` marks it as belonging to no exam,
 * which is honest — the model was never given a taxonomy, and every `topic` it returns is null.
 */
export function SuggestLink({
  studentId,
  disabled,
  onLoad,
  onPendingChange,
}: {
  studentId: string;
  disabled: boolean;
  onLoad: (template: MentorshipProgramTemplateDto) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const t = useTranslations("mentorship");
  const toast = useMentorToast();
  const showError = useShowError();
  const [suggesting, setSuggesting] = useState(false);

  async function suggest() {
    setSuggesting(true);
    onPendingChange?.(true);
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
      onPendingChange?.(false);
    }
  }

  return (
    <button
      type="button"
      className={PANEL_LINK_BUTTON}
      aria-busy={suggesting || undefined}
      disabled={disabled || suggesting}
      onClick={() => void suggest()}
    >
      <Sparkles className="size-4" aria-hidden />
      {suggesting ? t("suggest_busy") : t("suggest_action")}
    </button>
  );
}

/**
 * "Şablon olarak kaydet" under the program: a quiet link that opens the name field in place.
 * Saving over an existing name replaces that template, so it asks once.
 */
export function TemplateSave({
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
  const [open, setOpen] = useState(false);
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
        confirmLabel: t("template_save_confirm"),
        cancelLabel: t("confirm_cancel"),
      }))
    ) {
      return;
    }
    setBusy(true);
    try {
      const saved = await saveTemplate({
        name: trimmed,
        examType,
        tasks: toTemplateTasks(drafts),
      });
      setTemplates((prev) => [
        saved,
        ...prev.filter((row) => row.id !== saved.id),
      ]);
      setName("");
      setOpen(false);
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
    <div className="flex flex-col gap-2 pt-1">
      <button
        type="button"
        className={`${PANEL_QUIET_BUTTON} self-start`}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        {t("template_save")}
      </button>
      {open ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-end gap-2">
            <TextField
              dense
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
              disabled={disabled || name.trim() === ""}
              onClick={() => void save()}
            >
              {t("template_save_confirm")}
            </Button>
            {named ? (
              <button
                type="button"
                className={PANEL_QUIET_BUTTON}
                disabled={busy}
                onClick={() => void remove(named)}
              >
                {t("template_delete_action")}
              </button>
            ) : null}
          </div>
          <p className={NOTE_CLASS}>{t("template_hint")}</p>
        </div>
      ) : null}
    </div>
  );
}
