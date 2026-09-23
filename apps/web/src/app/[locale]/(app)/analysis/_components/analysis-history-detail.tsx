"use client";

import { MoreHorizontal, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ExamSubjectDto, MockExamDto, MockExamSubjectDto } from "@mentor/types";
import { Skeleton } from "@mentor/ui";
import { FormError } from "@/components/form";
import { PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu";
import { Link } from "@/i18n/navigation";
import { buildCoachMockExamHref } from "@/lib/coach";
import { useMentorBottomSheet } from "@/lib/mentor-bottom-sheet";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import { deleteMockExam, fetchMockExamById } from "@/lib/mock-exams";
import { AnalysisHistoryEditSheet } from "./analysis-history-edit-sheet";
import { formatTrendDate } from "./analysis-types";
import { errorMessage } from "./use-analysis-data";

/** Blank is the remainder, not a category: a quiet neutral that still reads on the tinted row. */
const BLANK_FILL = "bg-[color-mix(in_srgb,var(--color-secondary)_30%,transparent)]";

/**
 * An exam opened in place under its history row: each subject as correct / wrong / blank, then the
 * two things worth doing with it. Editing and deleting are rarer, so they wait in the row's menu.
 */
export function AnalysisHistoryDetail({
  mockExamId,
  subjects,
  onClose,
  onChanged,
}: {
  mockExamId: string;
  subjects: ExamSubjectDto[];
  onClose: () => void;
  onChanged: () => void;
}) {
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
        if (active) setError(errorMessage(loadError));
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
      setError(errorMessage(deleteError));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      id={`analysis-history-panel-${mockExamId}`}
      role="region"
      aria-label={t("detail_title")}
      aria-busy={deleting || undefined}
      className="mb-2 flex flex-col gap-3 rounded-[var(--radius-card)] bg-[color-mix(in_srgb,var(--play-track)_60%,transparent)] p-3"
      data-testid="analysis-history-accordion"
    >
      <FormError message={error} />
      {detail ? (
        <>
          <div className="flex gap-3" aria-hidden>
            <LegendDot fill="bg-[var(--chart-correct)]" label={tAnalysis("correct")} />
            <LegendDot fill="bg-[var(--chart-wrong)]" label={tAnalysis("wrong")} />
            <LegendDot fill={BLANK_FILL} label={tAnalysis("blank")} />
          </div>
          <ul className="flex flex-col gap-2.5" aria-label={t("subjects_table_caption")}>
            {detail.subjects.map((subject) => (
              <SubjectRow key={subject.subjectRef} subject={subject} />
            ))}
          </ul>
          {!deleting ? (
            <div className="flex items-center gap-4">
              <Link
                href={{
                  pathname: "/notebook",
                  query: { panel: "index", examId: detail.examId, mockExamId: detail.id },
                }}
                className={PANEL_TEXT_LINK}
              >
                {t("open_mistakes")}
              </Link>
              <Link
                href={buildCoachMockExamHref(
                  t("coach_seed", {
                    date: formatTrendDate(detail.takenAt, locale),
                    exam: detail.examName,
                  }),
                  detail.id,
                )}
                className={PANEL_TEXT_LINK}
              >
                <Sparkles
                  className="size-3.5 fill-current text-[var(--premium-ring-from)]"
                  aria-hidden
                />
                {tAnalysis("coach_cta")}
              </Link>
              <div className="ml-auto">
                <PopoverMenu
                  trigger={({ open, setOpen, menuId }) => (
                    <button
                      type="button"
                      aria-label={t("more_actions")}
                      aria-haspopup="menu"
                      aria-expanded={open}
                      aria-controls={open ? menuId : undefined}
                      onClick={() => setOpen(!open)}
                      className="grid size-11 cursor-pointer place-items-center rounded-[var(--radius-card)] text-[var(--color-main)] hover:bg-[var(--play-track)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                    >
                      <MoreHorizontal className="size-5" aria-hidden />
                    </button>
                  )}
                >
                  <PopoverMenuItem onClick={startEditing}>
                    <span className="flex items-center gap-2">
                      <Pencil className="size-4" aria-hidden />
                      {t("edit")}
                    </span>
                  </PopoverMenuItem>
                  <PopoverMenuItem danger onClick={() => void handleDelete()}>
                    <span className="flex items-center gap-2">
                      <Trash2 className="size-4" aria-hidden />
                      {t("delete")}
                    </span>
                  </PopoverMenuItem>
                </PopoverMenu>
              </div>
            </div>
          ) : null}
        </>
      ) : !error ? (
        <div className="flex min-h-40 flex-col gap-2.5" aria-busy aria-label={t("loading_detail")}>
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-4 w-full rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LegendDot({ fill, label }: { fill: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-secondary)]">
      <span className={`size-2 rounded-full ${fill}`} />
      {label}
    </span>
  );
}

/** One subject as a part-to-whole bar; the counts sit beside it, so colour is never the only cue. */
function SubjectRow({ subject }: { subject: MockExamSubjectDto }) {
  const t = useTranslations("analysis.history");
  const parts = [
    { count: subject.correct, fill: "bg-[var(--chart-correct)]" },
    { count: subject.wrong, fill: "bg-[var(--chart-wrong)]" },
    { count: subject.blank, fill: BLANK_FILL },
  ].filter((part) => part.count > 0);

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-caption font-extrabold text-[var(--color-main)]">
          {subject.subjectName}
        </span>
        <span aria-hidden className="text-xs font-bold tabular-nums text-[var(--color-secondary)]">
          {subject.correct} · {subject.wrong} · {subject.blank}
        </span>
        <span className="sr-only">
          {t("row_counts", {
            correct: subject.correct,
            wrong: subject.wrong,
            blank: subject.blank,
          })}
        </span>
        <span className="w-12 text-right text-caption font-black tabular-nums text-[var(--color-main)]">
          {subject.net}
        </span>
      </div>
      <div className="flex h-1.5 gap-0.5" aria-hidden>
        {parts.map((part) => (
          <span
            key={part.fill}
            className={`min-w-0 basis-0 rounded-full ${part.fill}`}
            style={{ flexGrow: part.count }}
          />
        ))}
      </div>
    </li>
  );
}
