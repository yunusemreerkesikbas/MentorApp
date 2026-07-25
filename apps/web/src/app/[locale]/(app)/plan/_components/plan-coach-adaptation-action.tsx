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
  ApplyPlanAdaptationResultDto,
  CoachPlanAdaptationDto,
} from "@mentor/types";
import {
  coachPlanAdaptationSchema,
  type CoachPlanAdaptationInput,
} from "@mentor/validation";
import {
  ApiClientError,
  subscriptionsControllerGetMine,
} from "@mentor/api-client";
import { Button, TextAreaField } from "@mentor/ui";
import Sparkles from "lucide-react/dist/esm/icons/sparkles.mjs";
import { useRouter } from "@/i18n/navigation";
import { FormError } from "@/components/form";
import { trackCoachEvent } from "@/lib/analytics";
import { requestCoachPlanAdaptation } from "@/lib/coach";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";
import { useMentorToast } from "@/lib/mentor-toast";
import { applyCoachPlanAdaptation } from "@/lib/plan-tasks";
import {
  flattenPlanAdaptationChanges,
  selectedPlanAdaptationChanges,
  type PlanAdaptationRow,
} from "@/lib/plan-coach-adaptation-utils";

interface PlanCoachAdaptationActionProps {
  onApplied: (result: ApplyPlanAdaptationResultDto) => Promise<void>;
  onPlanChanged: () => Promise<void>;
}

export interface PlanCoachAdaptationActionHandle {
  open: (input: CoachPlanAdaptationInput) => void;
}

interface NoteFormHandle {
  getInput: () => CoachPlanAdaptationInput | null;
  setError: (message: string) => void;
}

interface PreviewHandle {
  getSelectedChanges: () => CoachPlanAdaptationDto["changes"];
  setError: (message: string, stale?: boolean) => void;
}

function readError(error: unknown, fallback: string): string {
  return error instanceof ApiClientError
    ? error.message
    : error instanceof Error
      ? error.message
      : fallback;
}

const PlanCoachAdaptationNoteForm = forwardRef<NoteFormHandle>(
  function PlanCoachAdaptationNoteForm(_props, ref) {
    const t = useTranslations("plan");
    const [note, setNote] = useState("");
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      getInput: () => {
        const trimmed = note.trim();
        const parsed = coachPlanAdaptationSchema.safeParse({
          source: "PLAN",
          ...(trimmed ? { note: trimmed } : {}),
        });
        if (!parsed.success) {
          setError(t("coach_adaptation_note_invalid"));
          return null;
        }
        setError(null);
        return {
          source: "PLAN",
          ...(trimmed ? { note: trimmed } : {}),
        };
      },
      setError,
    }));

    return (
      <TextAreaField
        autoFocus
        label={t("coach_adaptation_note_label")}
        value={note}
        onChange={(event) => {
          setNote(event.target.value);
          if (error) setError(null);
        }}
        placeholder={t("coach_adaptation_note_placeholder")}
        hint={t("coach_adaptation_note_hint", { count: note.length })}
        error={error}
        maxLength={500}
        rows={4}
      />
    );
  },
);

interface PreviewProps {
  preview: CoachPlanAdaptationDto;
  onRegenerate: () => void;
}

const PlanCoachAdaptationPreview = forwardRef<PreviewHandle, PreviewProps>(
  function PlanCoachAdaptationPreview({ preview, onRegenerate }, ref) {
    const t = useTranslations("plan");
    const locale = useLocale();
    const rows = useMemo(
      () => flattenPlanAdaptationChanges(preview.changes),
      [preview.changes],
    );
    const [selected, setSelected] = useState<Set<string>>(
      () => new Set(rows.map((row) => row.key)),
    );
    const [error, setError] = useState<string | null>(null);
    const [stale, setStale] = useState(false);
    const rowsByDate = useMemo(() => {
      const grouped = new Map<string, PlanAdaptationRow[]>();
      for (const row of rows) {
        const day = grouped.get(row.date) ?? [];
        day.push(row);
        grouped.set(row.date, day);
      }
      return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
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
    const formatDate = (date: string) =>
      dateFormatter.format(new Date(`${date}T12:00:00`));

    useImperativeHandle(ref, () => ({
      getSelectedChanges: () => selectedPlanAdaptationChanges(rows, selected),
      setError: (message, isStale = false) => {
        setError(message);
        setStale(isStale);
      },
    }));

    function toggle(key: string) {
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      if (error && !stale) setError(null);
    }

    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
          {preview.message}
        </p>
        <FormError message={error} />
        {stale ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onRegenerate}
            fullWidth
          >
            <Sparkles size={17} aria-hidden />
            {t("coach_adaptation_regenerate")}
          </Button>
        ) : null}
        {rowsByDate.map(([date, dayRows]) => (
          <section key={date} aria-labelledby={`coach-adaptation-${date}`}>
            <h3
              id={`coach-adaptation-${date}`}
              className="mb-2 text-sm font-bold capitalize"
              style={{
                color: "var(--color-main)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {formatDate(date)}
            </h3>
            <div className="flex flex-col gap-2">
              {dayRows.map((row) => (
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
                      className="block text-xs font-bold uppercase"
                      style={{ color: "var(--color-secondary)" }}
                    >
                      {row.change.kind === "MOVE"
                        ? t("coach_adaptation_move")
                        : t("coach_adaptation_add")}
                    </span>
                    <span
                      className="block text-sm font-semibold"
                      style={{ color: "var(--color-body)" }}
                    >
                      {row.change.title}
                    </span>
                    {row.change.kind === "MOVE" ? (
                      <span
                        className="mt-0.5 block text-xs"
                        style={{ color: "var(--color-secondary)" }}
                      >
                        {t("coach_adaptation_move_dates", {
                          from: formatDate(row.change.fromDate),
                          to: formatDate(row.change.toDate),
                        })}
                      </span>
                    ) : null}
                    {row.change.subject ? (
                      <span
                        className="mt-0.5 block text-xs"
                        style={{ color: "var(--color-secondary)" }}
                      >
                        {row.change.subject}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </section>
        ))}
        {rows.length > 0 ? (
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--color-secondary)" }}
            aria-live="polite"
          >
            {t("coach_adaptation_selected_count", { count: selected.size })}
          </p>
        ) : null}
      </div>
    );
  },
);

export const PlanCoachAdaptationAction = forwardRef<
  PlanCoachAdaptationActionHandle,
  PlanCoachAdaptationActionProps
>(function PlanCoachAdaptationAction({ onApplied, onPlanChanged }, ref) {
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { filterSheet, dismissNow } = useMentorBottomSheet();
  const toast = useMentorToast();
  const noteRef = useRef<NoteFormHandle>(null);
  const previewRef = useRef<PreviewHandle>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);

  async function openPreview(
    preview: CoachPlanAdaptationDto,
    input: CoachPlanAdaptationInput,
  ) {
    const applied: { result: ApplyPlanAdaptationResultDto | null } = {
      result: null,
    };
    const regenerate = () => {
      dismissNow();
      queueMicrotask(() => void generatePreview(input));
    };
    const result = await filterSheet({
      title: t("coach_adaptation_preview_title"),
      applyLabel:
        preview.status === "READY"
          ? t("coach_adaptation_apply_selected")
          : t("coach_adaptation_close"),
      children: (
        <PlanCoachAdaptationPreview
          ref={previewRef}
          preview={preview}
          onRegenerate={regenerate}
        />
      ),
      onApply: async () => {
        if (preview.status === "NO_CHANGE") return;
        const changes = previewRef.current?.getSelectedChanges() ?? [];
        if (changes.length === 0) {
          previewRef.current?.setError(t("coach_adaptation_select_required"));
          throw new Error("validation");
        }
        try {
          applied.result = await applyCoachPlanAdaptation({
            planRevision: preview.planRevision,
            changes,
          });
        } catch (error) {
          const stale = error instanceof ApiClientError && error.status === 409;
          if (stale) await onPlanChanged();
          previewRef.current?.setError(
            readError(error, tCommon("error_unknown")),
            stale,
          );
          throw error;
        }
      },
    });

    if (result !== "apply" || !applied.result) return;
    await onApplied(applied.result);
    const moveCount = applied.result.moved.length;
    const addCount = applied.result.added.length;
    trackCoachEvent("coach_plan_adaptation_apply", {
      source: input.source,
      move_count: moveCount,
      add_count: addCount,
    });
    toast.success({
      title: t("coach_adaptation_success_title"),
      message: t("coach_adaptation_success_message", {
        moveCount,
        addCount,
      }),
      duration: 3000,
    });
  }

  async function generatePreview(input: CoachPlanAdaptationInput) {
    setBusy(true);
    try {
      trackCoachEvent("coach_plan_adaptation_request", {
        source: input.source,
      });
      const preview = await requestCoachPlanAdaptation(input);
      await openPreview(preview, input);
    } catch (error) {
      toast.error({
        title: tCommon("error_title"),
        message: readError(error, tCommon("error_unknown")),
        duration: 3000,
      });
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }

  async function open(input: CoachPlanAdaptationInput) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const subscription = await subscriptionsControllerGetMine();
      const view = subscription as unknown as {
        entitlement: { isPremium: boolean };
      };
      if (!view.entitlement.isPremium) {
        busyRef.current = false;
        setBusy(false);
        router.push("/subscription");
        return;
      }

      if (input.source !== "PLAN") {
        await generatePreview(input);
        return;
      }

      const generated: { input: CoachPlanAdaptationInput | null } = {
        input: null,
      };
      const result = await filterSheet({
        title: t("coach_adaptation_note_title"),
        applyLabel: t("coach_adaptation_generate"),
        children: <PlanCoachAdaptationNoteForm ref={noteRef} />,
        onApply: () => {
          const parsed = noteRef.current?.getInput() ?? null;
          if (!parsed) throw new Error("validation");
          generated.input = parsed;
        },
      });
      if (result === "apply" && generated.input) {
        await generatePreview(generated.input);
      }
    } catch (error) {
      toast.error({
        title: tCommon("error_title"),
        message: readError(error, tCommon("error_unknown")),
        duration: 3000,
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  useImperativeHandle(ref, () => ({
    open: (input) => void open(input),
  }));

  return (
    <Button
      type="button"
      variant="ghost"
      busy={busy}
      onClick={() => void open({ source: "PLAN" })}
      className="min-h-10 px-3 py-2 text-sm"
    >
      <Sparkles size={16} strokeWidth={2.25} aria-hidden />
      {t("coach_adaptation_cta")}
    </Button>
  );
});
