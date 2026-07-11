"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import X from "lucide-react/dist/esm/icons/x.mjs";
import type { ExamSubjectDto, MockExamDto } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { Button, Card } from "@mentor/ui";
import { FormError } from "@/components/form";
import { useMentorDialog } from "@/lib/mentor-dialog";
import { useMentorToast } from "@/lib/mentor-toast";
import {
  deleteMockExam,
  fetchMockExamById,
  updateMockExam,
} from "@/lib/analiz";
import { AnalizMockExamForm } from "./analiz-mock-exam-form";
import {
  formatTrendDate,
  scoresFromMockExam,
  type SubjectScores,
} from "./analiz-types";

interface AnalizHistoryDetailProps {
  mockExamId: string | null;
  subjects: ExamSubjectDto[];
  onClose: () => void;
  onChanged: () => void;
}

export function AnalizHistoryDetail({
  mockExamId,
  subjects,
  onClose,
  onChanged,
}: AnalizHistoryDetailProps) {
  const t = useTranslations("analysis.history");
  const locale = useLocale();
  const dialog = useMentorDialog();
  const toast = useMentorToast();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [detail, setDetail] = useState<MockExamDto | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [scores, setScores] = useState<Record<string, SubjectScores>>({});
  const [publisherName, setPublisherName] = useState("");
  const [takenAtDate, setTakenAtDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const open = mockExamId != null;
  const mutating = saving || deleting;

  useEffect(() => {
    if (!mockExamId) {
      setDetail(null);
      setMode("view");
      setError(null);
      return;
    }
    let active = true;
    setDetail(null);
    setMode("view");
    setError(null);
    fetchMockExamById(mockExamId)
      .then((dto) => {
        if (active) setDetail(dto);
      })
      .catch((err: unknown) => {
        if (active) setError(toErrorMessage(err));
      });
    return () => {
      active = false;
    };
  }, [mockExamId]);

  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !mutating) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mutating, onClose, open]);

  function startEditing() {
    if (!detail) return;
    setScores(scoresFromMockExam(subjects, detail.subjects));
    setPublisherName(detail.publisherName ?? "");
    setTakenAtDate(detail.takenAt.slice(0, 10));
    setError(null);
    setMode("edit");
  }

  function updateScore(
    slug: string,
    field: keyof SubjectScores,
    value: string,
  ) {
    setScores((current) => ({
      ...current,
      [slug]: { ...current[slug]!, [field]: value },
    }));
  }

  async function handleUpdate(event: React.FormEvent) {
    event.preventDefault();
    if (!detail || saving || !takenAtDate) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateMockExam(detail.id, {
        takenAt: new Date(takenAtDate + "T12:00:00").toISOString(),
        publisherName: publisherName.trim() || null,
        subjects: subjects.map((subject) => ({
          subjectRef: subject.slug,
          correct: Number(scores[subject.slug]?.correct || 0),
          wrong: Number(scores[subject.slug]?.wrong || 0),
          blank: Number(scores[subject.slug]?.blank || 0),
        })),
      });
      setDetail(updated);
      setMode("view");
      onChanged();
      toast.success({
        title: t("update_success_title"),
        message: t("update_success_message"),
      });
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
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
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  if (!open) return null;

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
        className="fixed bottom-0 right-0 z-30 flex w-full max-w-md flex-col overflow-hidden sm:rounded-tl-[var(--radius-card)]"
        style={{
          top: "3.5rem",
          background: "var(--color-bg, white)",
          boxShadow: "var(--shadow-card)",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="analiz-history-title"
        aria-busy={mutating || undefined}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-3"
          style={{
            borderColor:
              "color-mix(in srgb, var(--color-main) 8%, transparent)",
          }}
        >
          <h2
            id="analiz-history-title"
            className="text-base font-bold"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {mode === "edit" ? t("edit_title") : t("detail_title")}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={mutating}
            aria-label={t("close")}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            style={{ color: "var(--color-secondary)" }}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <FormError message={error} />
          {detail ? (
            mode === "edit" ? (
              <AnalizMockExamForm
                subjects={subjects}
                scores={scores}
                submitting={saving}
                publisherName={publisherName}
                takenAtDate={takenAtDate}
                onPublisherChange={setPublisherName}
                onTakenAtChange={setTakenAtDate}
                onScoreChange={updateScore}
                onSubmit={(event) => void handleUpdate(event)}
                submitLabel={t("save_edit")}
                onCancel={() => {
                  setMode("view");
                  setError(null);
                }}
              />
            ) : (
              <Card className="flex flex-col gap-4">
                <div>
                  <p
                    className="text-xl font-bold tabular-nums"
                    style={{
                      color: "var(--color-main)",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    {detail.totalNet}
                  </p>
                  <p
                    className="text-sm"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    {detail.publisherName
                      ? detail.publisherName + " · "
                      : ""}
                    {detail.examName} · {formatTrendDate(detail.takenAt, locale)}
                  </p>
                </div>
                <ul className="flex flex-col gap-2">
                  {detail.subjects.map((subject) => (
                    <li
                      key={subject.subjectRef}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span style={{ color: "var(--color-body)" }}>
                        {subject.subjectName}
                      </span>
                      <span
                        className="tabular-nums"
                        style={{ color: "var(--color-secondary)" }}
                      >
                        D{subject.correct} Y{subject.wrong} B{subject.blank} ·{" "}
                        {subject.net}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="secondary"
                    fullWidth
                    onClick={startEditing}
                  >
                    {t("edit")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    fullWidth
                    busy={deleting}
                    onClick={() => void handleDelete()}
                  >
                    {t("delete")}
                  </Button>
                </div>
              </Card>
            )
          ) : !error ? (
            <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
              …
            </p>
          ) : null}
        </div>
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
