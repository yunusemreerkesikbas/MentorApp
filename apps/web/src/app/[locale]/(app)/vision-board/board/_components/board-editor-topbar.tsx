"use client";

import type { ReactNode } from "react";
import { ArrowLeft, Check, LoaderCircle, Redo2, Share2, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import { Link } from "@/i18n/navigation";

/** A round control that sits on the wall, the same disc the notebook floats over its pages. */
const CHROME_BUTTON =
  "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-main)] shadow-[var(--shadow-card)] outline-none transition-colors hover:text-[var(--play-selected-ink)] disabled:cursor-not-allowed disabled:opacity-35 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none";

export interface BoardEditorTopbarProps {
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
  saving: boolean;
  /** A published board keeps "Kaydet" as its one filled action; a draft offers the publish ledge. */
  published: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Opens the share window. */
  onShare: () => void;
  onSave: () => void;
  onPublish: () => void;
}

/**
 * The row above the board: the way back, the history, the save state and what leaves the editor.
 *
 * One DOM order for both layouts. A phone reads back, history, state, share; from `lg` the history
 * joins the cluster on the right, and the back button stands over the rail's own centre line.
 * The row may wrap: a draft's publish ledge is wider than a phone has left, and a second line is
 * better than a clipped label.
 */
export function BoardEditorTopbar({
  canUndo,
  canRedo,
  dirty,
  saving,
  published,
  onUndo,
  onRedo,
  onShare,
  onSave,
  onPublish,
}: BoardEditorTopbarProps) {
  const t = useTranslations("vision.board");

  return (
    // 1.375rem: the rail's 0.5rem inset plus half of what its 4.5rem leaves around a 2.75rem disc.
    <header className="flex shrink-0 flex-wrap items-center gap-1.5 px-3 pt-2 lg:pe-4 lg:ps-[1.375rem] lg:pt-3">
      <Link href="/vision-board" aria-label={t("back")} title={t("back")} className={CHROME_BUTTON}>
        <ArrowLeft aria-hidden size={18} />
      </Link>

      <div className="flex items-center gap-1.5 lg:order-3">
        <IconButton label={t("undo")} disabled={!canUndo} onClick={onUndo}>
          <Undo2 aria-hidden size={17} />
        </IconButton>
        <IconButton label={t("redo")} disabled={!canRedo} onClick={onRedo}>
          <Redo2 aria-hidden size={17} />
        </IconButton>
      </div>

      <span aria-hidden className="flex-1 lg:order-1" />

      {/* Leftmost of the right-hand cluster, so its changing width moves nothing beside it. */}
      <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--color-surface)] px-2.5 text-xs font-bold text-[var(--color-secondary)] shadow-[var(--shadow-card)] lg:order-2">
        {dirty ? (
          <span aria-hidden className="size-2 rounded-full bg-[var(--play-cta)]" />
        ) : (
          <Check
            aria-hidden
            size={14}
            strokeWidth={2.5}
            className="text-[var(--color-success)]"
          />
        )}
        {/* Words from `sm`: on a phone they would push the save button onto a second line each
            time the state flipped. */}
        <span className="max-sm:sr-only">{dirty ? t("unsaved") : t("saved_state")}</span>
      </span>

      {/* One way out for the picture: the share window holds the download and the formats. A disc
          on a phone, the same disc grown into a labelled pill where there is room. */}
      <button
        type="button"
        onClick={onShare}
        className={`${CHROME_BUTTON} gap-2 lg:order-4 lg:w-auto lg:px-4 lg:text-sm lg:font-extrabold lg:text-[var(--play-selected-ink)]`}
      >
        <Share2 aria-hidden size={17} />
        <span className="max-lg:sr-only">{t("share")}</span>
      </button>

      <div className="ms-auto flex items-center gap-1.5 lg:order-5">
        {published ? (
          <button
            type="button"
            disabled={saving || !dirty}
            aria-busy={saving || undefined}
            onClick={onSave}
            // The page's one action, so it wears the play CTA's blue and navy ink (DESIGN.md §6).
            className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--play-cta)] px-4 text-sm font-extrabold text-[var(--play-cta-ink)] shadow-[var(--shadow-card)] outline-none disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            {saving ? <Spinner /> : null}
            {t("save")}
          </button>
        ) : (
          <>
            {/* Autosave covers a phone; the words come back where there is room for them. */}
            <button
              type="button"
              disabled={saving}
              onClick={onSave}
              className="inline-flex h-11 cursor-pointer items-center rounded-full px-3 text-sm font-extrabold text-[var(--play-selected-ink)] outline-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] max-lg:hidden"
            >
              {t("save")}
            </button>
            <Button size="sm" busy={saving} onClick={onPublish}>
              {t("publish")}
            </Button>
          </>
        )}
      </div>
    </header>
  );
}

function Spinner() {
  return (
    <LoaderCircle aria-hidden size={15} className="animate-spin motion-reduce:animate-none" />
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={CHROME_BUTTON}
    >
      {children}
    </button>
  );
}
