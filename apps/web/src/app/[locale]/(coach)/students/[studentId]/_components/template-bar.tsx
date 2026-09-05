"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { MentorshipProgramTemplateDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, TextField } from "@mentor/ui";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import { deleteTemplate, fetchTemplates, saveTemplate } from "@/lib/mentorship";
import { ComposerSelect } from "./composer-select";
import { toTemplateTasks, type DatedDraft } from "./template-apply";

/**
 * Save / load / delete for the composer's saved programs.
 *
 * It owns the template list and nothing else: the composer keeps the drafts, hands them over on
 * save, and takes a template back on load. Loading fills the composer client-side — there is no
 * server-side "apply" — so the coach sees exactly what will be written and the subject/topic
 * picker stays the only real gate on a program built against another exam's taxonomy.
 */
export function TemplateBar({
  drafts,
  examType,
  disabled,
  onLoad,
}: {
  drafts: readonly DatedDraft[];
  /** The STUDENT's exam: what a template saved from this composer was built against. */
  examType: string | null;
  disabled: boolean;
  onLoad: (template: MentorshipProgramTemplateDto) => void;
}) {
  const t = useTranslations("mentorship");
  const common = useTranslations("common");
  const toast = useMentorToast();
  const dialog = useMentorDialog();
  const [templates, setTemplates] = useState<MentorshipProgramTemplateDto[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

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

  function showError(err: unknown) {
    toast.error({
      title: common("error_title"),
      message: err instanceof ApiClientError ? err.message : common("error_unknown"),
    });
  }

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
    <div
      className="flex flex-col gap-2 border-b pb-4"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <ComposerSelect
          label={t("template_load")}
          value=""
          placeholder={
            templates.length === 0 ? t("template_none") : t("template_load_placeholder")
          }
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
        <TextField
          label={t("template_name")}
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            busy={busy}
            disabled={disabled || drafts.length === 0 || name.trim() === ""}
            onClick={save}
          >
            {t("template_save")}
          </Button>
          {named && (
            <Button type="button" variant="ghost" busy={busy} onClick={() => remove(named)}>
              {t("template_delete_action")}
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
        {t("template_hint")}
      </p>
    </div>
  );
}
