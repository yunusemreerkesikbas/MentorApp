"use client";
import { Pencil, Sparkles, Trash2, X } from "lucide-react";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ExamSubjectDto, MockExamDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Skeleton } from "@mentor/ui";
import { FormError } from "@/components/form";
import { Link } from "@/i18n/navigation";
import { buildCoachMockExamHref } from "@/lib/coach";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import { deleteMockExam, fetchMockExamById } from "@/lib/mock-exams";
import { AnalysisHistoryEditSheet } from "./analysis-history-edit-sheet";
import { formatTrendDate } from "./analysis-types";

const pillBtnClass =
  "inline-flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full border bg-[var(--color-surface)] px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_3%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none";

interface AnalysisHistoryDetailProps {
  mockExamId: string;
  subjects: ExamSubjectDto[];
  onClose: () => void;
  onChanged: () => void;
  /** Inline expand under a history row (rail/drawer). */
  variant?: "accordion" | "drawer";
}

/**
 * Mock-exam detail — accordion (default) under the history row, or legacy drawer.
 * Edit opens in a bottom sheet so the narrow rail stays read-only.
 */
export function AnalysisHistoryDetail({
  mockExamId,
  subjects,
  onClose,
  onChanged,
  variant = "accordion",
}: AnalysisHistoryDetailProps) {
  const t = useTranslations("analysis.history");
  const tAnalysis = useTranslations("analysis");
  const locale = useLocale();
  const dialog = useMentorDialog();
  const toast = useMentorToast();
  const sheet = useMentorBottomSheet();
  const [detail, setDetail] = useState<MockExamDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Switching rows clears the previous exam before the new fetch resolves — adjusted during render
  // so the stale detail is never painted for a frame (an effect reset would flash it).
  const [loadedId, setLoadedId] = useState(mockExamId);
  if (loadedId !== mockExamId) {
    setLoadedId(mockExamId);
    setDetail(null);
    setError(null);
  }

  useEffect(() => {
    let active = true;
    fetchMockExamById(mockExamId)
      .then((dto) => {
        if (active) setDetail(dto);
      })
      .catch((loadError: unknown) => {
        if (active) setError(toErrorMessage(loadError));
      });
    return () => {
      active = false;
    };
  }, [mockExamId]);

  function startEditing() {
    if (!detail) return;
    sheet.show({
      title: t("edit_title"),
      layout: "filter",
      bodyScroll: true,
      children: (
        <AnalysisHistoryEditSheet
          detail={detail}
          subjects={subjects}
          onCancel={() => sheet.dismissNow()}
          onSaved={(updated) => {
            setDetail(updated);
            sheet.dismissNow();
            onChanged();
            toast.success({
              title: t("update_success_title"),
              message: t("update_success_message"),
            });
          }}
        />
      ),
    });
  }

  async function handleDelete() {
    if (!detail || deleting) return;
    const confirmed = await dialog.confirm({
      title: t("delete_confirm_title"),
      message: t("delete_confirm_message", {
        name: detail.publisherName ?? detail.examName,
        date: formatTrendDate(detail.takenAt, locale),
      }),
      confirmLabel: t("delete_confirm_yes"),
      cancelLabel: t("delete_confirm_no"),
    });
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteMockExam(detail.id);
      onClose();
      onChanged();
      toast.success({
        title: t("delete_success_title"),
        message: t("delete_success_message"),
      });
    } catch (deleteError) {
      setError(toErrorMessage(deleteError));
    } finally {
      setDeleting(false);
    }
  }

  const body = (
    <div className="flex flex-col gap-3" aria-busy={deleting || undefined}>
      <FormError message={error} />
      {detail ? (
        <>
          {/* Accordion row already shows publisher, date, and net — skip duplicate chrome. */}
          {variant !== "accordion" ? (
            <div>
              <p
                className="text-lg font-bold tabular-nums"
                style={{
                  color: "var(--color-main)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {detail.totalNet}
              </p>
              <p
                className="text-xs"
                style={{ color: "var(--color-secondary)" }}
              >
                {detail.publisherName ? detail.publisherName + " · " : ""}
                {detail.examName}
              </p>
              <p
                className="text-xs"
                style={{ color: "var(--color-secondary)" }}
              >
                {formatTrendDate(detail.takenAt, locale)}
              </p>
            </div>
          ) : null}

          <div className="overflow-x-auto mentor-scrollarea">
            <table className="w-full min-w-[14rem] border-collapse text-left text-xs">
              <caption className="sr-only">{t("subjects_table_caption")}</caption>
              <thead>
                <tr
                  style={{
                    borderBottom:
                      "1px solid color-mix(in srgb, var(--color-main) 10%, transparent)",
                  }}
                >
                  <th
                    className="py-1.5 pr-2 font-semibold"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    {t("col_subject")}
                  </th>
                  <th
                    className="px-1 py-1.5 text-center font-semibold tabular-nums"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    {t("col_correct")}
                  </th>
                  <th
                    className="px-1 py-1.5 text-center font-semibold tabular-nums"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    {t("col_wrong")}
                  </th>
                  <th
                    className="px-1 py-1.5 text-center font-semibold tabular-nums"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    {t("col_blank")}
                  </th>
                  <th
                    className="py-1.5 pl-2 text-right font-semibold tabular-nums"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    {t("col_net")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {detail.subjects.map((subject) => (
                  <tr
                    key={subject.subjectRef}
                    style={{
                      borderBottom:
                        "1px solid color-mix(in srgb, var(--color-main) 6%, transparent)",
                    }}
                  >
                    <td
                      className="max-w-[6.5rem] truncate py-1.5 pr-2 font-medium"
                      style={{ color: "var(--color-body)" }}
                      title={subject.subjectName}
                    >
                      {subject.subjectName}
                    </td>
                    <td
                      className="px-1 py-1.5 text-center tabular-nums"
                      style={{ color: "var(--color-secondary)" }}
                    >
                      {subject.correct}
                    </td>
                    <td
                      className="px-1 py-1.5 text-center tabular-nums"
                      style={{ color: "var(--color-secondary)" }}
                    >
                      {subject.wrong}
                    </td>
                    <td
                      className="px-1 py-1.5 text-center tabular-nums"
                      style={{ color: "var(--color-secondary)" }}
                    >
                      {subject.blank}
                    </td>
                    <td
                      className="py-1.5 pl-2 text-right font-semibold tabular-nums"
                      style={{
                        color: "var(--color-main)",
                        fontFamily: "var(--font-heading)",
                      }}
                    >
                      {subject.net}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!deleting ? (
            <Link
              href={buildCoachMockExamHref(
                t("coach_seed", {
                  date: formatTrendDate(detail.takenAt, locale),
                  exam: detail.examName,
                }),
                detail.id,
              )}
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-card)] border bg-transparent px-3 py-2 text-sm font-bold transition-colors hover:bg-[color-mix(in_srgb,var(--color-main)_4%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
              style={{
                color: "var(--color-main)",
                borderColor:
                  "color-mix(in srgb, var(--color-main) 15%, transparent)",
                fontFamily: "var(--font-body)",
              }}
            >
              <Sparkles size={16} strokeWidth={2.25} aria-hidden />
              {tAnalysis("coach_cta")}
            </Link>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={startEditing}
              disabled={deleting}
              className={pillBtnClass}
              style={{
                color: "var(--color-main)",
                borderColor:
                  "color-mix(in srgb, var(--color-main) 18%, transparent)",
                fontFamily: "var(--font-heading)",
              }}
            >
              <Pencil size={14} strokeWidth={2.25} aria-hidden />
              {t("edit")}
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              aria-busy={deleting || undefined}
              className={pillBtnClass}
              style={{
                color: "var(--color-danger)",
                borderColor:
                  "color-mix(in srgb, var(--color-danger) 35%, transparent)",
                fontFamily: "var(--font-heading)",
              }}
            >
              <Trash2 size={14} strokeWidth={2.25} aria-hidden />
              {t("delete")}
            </button>
          </div>
        </>
      ) : !error ? (
        <div
          className={`flex flex-col gap-2.5 ${variant === "accordion" ? "min-h-[10rem]" : "min-h-[13rem]"}`}
          aria-busy
          aria-label={t("loading_detail")}
        >
          {variant !== "accordion" ? (
            <>
              <Skeleton className="h-7 w-20 rounded-[var(--radius-card)]" />
              <Skeleton className="h-3 w-36 rounded-[var(--radius-card)]" />
              <Skeleton className="h-3 w-24 rounded-[var(--radius-card)]" />
            </>
          ) : null}
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton
                key={index}
                className="h-4 w-full rounded-[var(--radius-card)]"
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );

  if (variant === "accordion") {
    return (
      <div
        id={`analysis-history-panel-${mockExamId}`}
        role="region"
        aria-label={t("detail_title")}
        className="mt-0.5 rounded-[10px] px-2.5 py-3"
        style={{
          backgroundColor: "var(--color-surface)",
          border:
            "1px solid color-mix(in srgb, var(--color-main) 8%, transparent)",
          boxShadow: "var(--shadow-card)",
        }}
        data-testid="analysis-history-accordion"
      >
        {body}
      </div>
    );
  }

  return (
    <HistoryDetailDrawer
      title={t("detail_title")}
      closeLabel={t("close")}
      mutating={deleting}
      onClose={onClose}
    >
      {body}
    </HistoryDetailDrawer>
  );
}

function HistoryDetailDrawer({
  title,
  closeLabel,
  mutating,
  onClose,
  children,
}: {
  title: string;
  closeLabel: string;
  mutating: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    document.documentElement.classList.add("mentor-drawer-open");
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      cancelAnimationFrame(frame);
      document.documentElement.classList.remove("mentor-drawer-open");
      const previousFocus = previousFocusRef.current;
      previousFocusRef.current = null;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !mutating) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mutating, onClose]);

  return (
    <>
      <div
        className="fixed inset-0 z-[29] bg-black/30 motion-reduce:transition-none"
        style={{ top: "3.5rem" }}
        onClick={() => {
          if (!mutating) onClose();
        }}
        aria-hidden
      />
      <div
        ref={panelRef}
        className="fixed bottom-0 right-0 z-30 flex w-full max-w-md flex-col overflow-hidden sm:rounded-tl-[var(--radius-card)]"
        style={{
          top: "3.5rem",
          background: "var(--color-surface)",
          boxShadow: "var(--shadow-card)",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="analysis-history-title"
      >
        <div
          className="flex items-center justify-between border-b px-5 py-3"
          style={{
            borderColor:
              "color-mix(in srgb, var(--color-main) 8%, transparent)",
          }}
        >
          <h2
            id="analysis-history-title"
            className="text-base font-bold"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {title}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={mutating}
            aria-label={closeLabel}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ color: "var(--color-secondary)" }}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </>
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : error instanceof Error
      ? error.message
      : String(error);
}
