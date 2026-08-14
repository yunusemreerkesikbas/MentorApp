"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { NotebookEntryDto } from "@mentor/types";
import { Button, Card, Chip, SectionHeading } from "@mentor/ui";
import { FormError } from "@/components/form";
import { reviewNotebookEntry } from "@/lib/notebook";

interface NotebookReviewPanelProps {
  entries: NotebookEntryDto[];
  onReviewed: (entry: NotebookEntryDto) => void;
  onClose: () => void;
}

/**
 * The review loop: one card at a time, one question, two buttons.
 *
 * Deliberately not a checklist of everything due. A list invites skimming and ticking; a single
 * card asks the student to actually look at the question again, which is the only part of this
 * feature that changes a net. Progress is shown as "3 / 7" rather than a percentage bar for the
 * same reason — a bar rewards finishing, a counter just says where you are.
 *
 * "Çözemedim" is not a failure state and is never styled as one: it costs nothing but a shorter
 * interval, and a review flow that punishes honesty teaches the student to lie to it.
 */
export function NotebookReviewPanel({
  entries,
  onReviewed,
  onClose,
}: NotebookReviewPanelProps) {
  const t = useTranslations("notebook");
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entry = entries[index];

  if (!entry) {
    return (
      <Card className="flex flex-col items-start gap-3">
        <SectionHeading as="h2" subtitle={t("review_done_subtitle")}>
          {t("review_done_title")}
        </SectionHeading>
        <Button onClick={onClose}>{t("review_close")}</Button>
      </Card>
    );
  }

  async function answer(solved: boolean) {
    if (!entry) return;
    setBusy(true);
    setError(null);
    try {
      onReviewed(await reviewNotebookEntry(entry.id, solved));
      setIndex((current) => current + 1);
    } catch {
      setError(t("error_review"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <SectionHeading as="h2" subtitle={t("review_subtitle")}>
          {t("review_title")}
        </SectionHeading>
        <Chip>{t("review_progress", { current: index + 1, total: entries.length })}</Chip>
      </div>

      <FormError message={error} />

      {entry.url ? (
        <div className="relative mx-auto aspect-[4/3] w-full max-w-sm overflow-hidden rounded-[var(--radius-card)]">
          <Image src={entry.url} alt="" fill className="object-contain" unoptimized />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Chip>{t(`error_type.${entry.errorType}`)}</Chip>
        {entry.topicName ?? entry.subjectName ? (
          <span className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {entry.topicName ?? entry.subjectName}
          </span>
        ) : null}
      </div>

      {entry.note ? (
        <p className="text-sm" style={{ color: "var(--color-body)" }}>
          {entry.note}
        </p>
      ) : null}

      <p className="text-sm font-semibold" style={{ color: "var(--color-main)" }}>
        {t("review_question")}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void answer(true)}>
          {t("review_solved")}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => void answer(false)}>
          {t("review_missed")}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onClose}>
          {t("review_later")}
        </Button>
      </div>
    </Card>
  );
}
