"use client";

import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import type {
  CoachPlanDraftDto,
  PlanTaskDto,
  SubscriptionView,
} from "@mentor/types";
import { planDraftSchema, type PlanDraftInput } from "@mentor/validation";
import {
  ApiClientError,
  subscriptionsControllerGetMine,
} from "@mentor/api-client";
import { Button, TextAreaField } from "@mentor/ui";
import Sparkles from "lucide-react/dist/esm/icons/sparkles.mjs";
import { useRouter } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { requestCoachPlanDraft } from "@/lib/coach";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";
import { useMentorToast } from "@/lib/mentor-toast";
import { createPlanTasksBulk } from "@/lib/plan-tasks";
import {
  flattenCoachPlanDraft,
  selectedDraftTasks,
  type PlanCoachDraftRow,
} from "@/lib/plan-coach-draft-utils";

interface PlanCoachDraftActionProps {
  onCreated: (tasks: PlanTaskDto[]) => void;
}

interface NoteFormHandle {
  getInput: () => PlanDraftInput | null;
  setError: (message: string) => void;
}

interface PreviewHandle {
  getSelectedTasks: () => ReturnType<typeof selectedDraftTasks>;
  setError: (message: string) => void;
}

function readError(error: unknown, fallback: string): string {
  return error instanceof ApiClientError
    ? error.message
    : error instanceof Error
      ? error.message
      : fallback;
}

const PlanCoachDraftNoteForm = forwardRef<NoteFormHandle>(
  function PlanCoachDraftNoteForm(_props, ref) {
    const t = useTranslations("plan");
    const [note, setNote] = useState("");
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      getInput: () => {
        const trimmed = note.trim();
        const parsed = planDraftSchema.safeParse(trimmed ? { note: trimmed } : {});
        if (!parsed.success) {
          setError(t("coach_draft_note_invalid"));
          return null;
        }
        setError(null);
        return parsed.data;
      },
      setError,
    }));

    return (
      <TextAreaField
        autoFocus
        label={t("coach_draft_note_label")}
        value={note}
        onChange={(event) => {
          setNote(event.target.value);
          if (error) setError(null);
        }}
        placeholder={t("coach_draft_note_placeholder")}
        hint={t("coach_draft_note_hint", { count: note.length })}
        error={error}
        maxLength={500}
        rows={4}
      />
    );
  },
);

interface PlanCoachDraftPreviewProps {
  draft: CoachPlanDraftDto;
}

const PlanCoachDraftPreview = forwardRef<PreviewHandle, PlanCoachDraftPreviewProps>(
  function PlanCoachDraftPreview({ draft }, ref) {
    const t = useTranslations("plan");
    const locale = useLocale();
    const rows = useMemo(() => flattenCoachPlanDraft(draft), [draft]);
    const [selected, setSelected] = useState<Set<string>>(
      () => new Set(rows.map((row) => row.key)),
    );
    const [error, setError] = useState<string | null>(null);
    const rowsByDate = useMemo(() => {
      const grouped = new Map<string, PlanCoachDraftRow[]>();
      for (const row of rows) {
        const day = grouped.get(row.date) ?? [];
        day.push(row);
        grouped.set(row.date, day);
      }
      return grouped;
    }, [rows]);
    const dateFormatter = useMemo(
      () =>
        new Intl.DateTimeFormat(locale, {
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
      [locale],
    );

    useImperativeHandle(ref, () => ({
      getSelectedTasks: () => selectedDraftTasks(rows, selected),
      setError,
    }));

    function toggle(key: string) {
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      if (error) setError(null);
    }

    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {t("coach_draft_preview_notice")}
        </p>
        <FormError message={error} />
        <div className="flex flex-col gap-4">
          {draft.days.map((day) => (
            <section key={day.date} aria-labelledby={`coach-draft-${day.date}`}>
              <h3
                id={`coach-draft-${day.date}`}
                className="mb-2 text-sm font-bold capitalize"
                style={{
                  color: "var(--color-main)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {dateFormatter.format(new Date(`${day.date}T12:00:00`))}
              </h3>
              <div className="flex flex-col gap-2">
                {(rowsByDate.get(day.date) ?? []).map((row) => (
                  <label
                    key={row.key}
                    className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-card)] border bg-white/50 px-3 py-2.5"
                    style={{ borderColor: "var(--color-progress-track)" }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(row.key)}
                      onChange={() => toggle(row.key)}
                      className="mt-0.5 size-5 shrink-0 accent-[var(--color-btn)]"
                    />
                    <span className="min-w-0">
                      <span
                        className="block text-sm font-semibold"
                        style={{ color: "var(--color-body)" }}
                      >
                        {row.title}
                      </span>
                      {row.subject ? (
                        <span
                          className="mt-0.5 block text-xs"
                          style={{ color: "var(--color-secondary)" }}
                        >
                          {row.subject}
                        </span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
        <p
          className="text-sm font-semibold"
          style={{ color: "var(--color-secondary)" }}
          aria-live="polite"
        >
          {t("coach_draft_selected_count", { count: selected.size })}
        </p>
      </div>
    );
  },
);

export function PlanCoachDraftAction({ onCreated }: PlanCoachDraftActionProps) {
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { filterSheet } = useMentorBottomSheet();
  const { error: showErrorToast, success: showSuccessToast } = useMentorToast();
  const noteRef = useRef<NoteFormHandle>(null);
  const previewRef = useRef<PreviewHandle>(null);
  const [checkingAccess, setCheckingAccess] = useState(false);

  async function openPreview(draft: CoachPlanDraftDto) {
    const saved: { tasks: PlanTaskDto[] | null } = { tasks: null };
    const result = await filterSheet({
      title: t("coach_draft_preview_title"),
      applyLabel: t("coach_draft_add_selected"),
      children: <PlanCoachDraftPreview ref={previewRef} draft={draft} />,
      onApply: async () => {
        const tasks = previewRef.current?.getSelectedTasks() ?? [];
        if (tasks.length === 0) {
          previewRef.current?.setError(t("coach_draft_select_required"));
          throw new Error("validation");
        }
        try {
          saved.tasks = await createPlanTasksBulk({ tasks });
        } catch (error) {
          previewRef.current?.setError(readError(error, tCommon("error_unknown")));
          throw error;
        }
      },
    });

    const created = saved.tasks;
    if (result !== "apply" || !created) return;
    onCreated(created);
    showSuccessToast({
      title: t("coach_draft_success_title"),
      message: t("coach_draft_success_message", { count: created.length }),
      duration: 3000,
    });
  }

  async function openDraftFlow() {
    if (checkingAccess) return;
    setCheckingAccess(true);
    let subscription: SubscriptionView;
    try {
      subscription =
        (await subscriptionsControllerGetMine()) as unknown as SubscriptionView;
    } catch (error) {
      showErrorToast({
        title: tCommon("error_title"),
        message: readError(error, tCommon("error_unknown")),
        duration: 3000,
      });
      setCheckingAccess(false);
      return;
    }
    setCheckingAccess(false);

    if (!subscription.entitlement.isPremium) {
      router.push("/abonelik");
      return;
    }

    const generated: { draft: CoachPlanDraftDto | null } = { draft: null };
    const result = await filterSheet({
      title: t("coach_draft_note_title"),
      applyLabel: t("coach_draft_generate"),
      children: <PlanCoachDraftNoteForm ref={noteRef} />,
      onApply: async () => {
        const input = noteRef.current?.getInput();
        if (!input) throw new Error("validation");
        try {
          generated.draft = await requestCoachPlanDraft(input);
        } catch (error) {
          noteRef.current?.setError(readError(error, tCommon("error_unknown")));
          throw error;
        }
      },
    });

    const draft = generated.draft;
    if (result === "apply" && draft) await openPreview(draft);
  }

  return (
    <Button
      type="button"
      variant="secondary"
      fullWidth
      busy={checkingAccess}
      onClick={() => void openDraftFlow()}
      className="sm:w-fit"
    >
      <Sparkles size={18} strokeWidth={2.25} aria-hidden />
      {t("coach_draft_cta")}
    </Button>
  );
}
