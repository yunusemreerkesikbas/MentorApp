"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Sparkles, X } from "lucide-react";
import type { CoachAccessDto, VisionDto, VisionNoteDto } from "@mentor/types";
import {
  aiChatControllerGetAccess,
  aiVisionControllerNote,
  coachingControllerGetVision,
} from "@mentor/api-client";
import { Card, Chip, SectionHeading } from "@mentor/ui";
import { Link, useRouter } from "@/i18n/navigation";
import { BoardFrame } from "@/components/vision-board/board-frame";
import { BoardStage } from "@/components/vision-board/board-stage";

/**
 * Vision/goal board ("hayal/vision-board panosu") panel card. Self-fetches the goal; free tier sees the
 * goal + a premium nudge, premium users additionally get a cached AI motivation note. Editing lives
 * on the dedicated `/vision-board` page (no nav tab).
 */
export function VisionBoardCard() {
  const reduceMotion = useReducedMotion();
  const translate = useTranslations("vision");
  const router = useRouter();
  const [vision, setVision] = useState<VisionDto | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [premium, setPremium] = useState<boolean | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const previewRef = useRef<HTMLDialogElement>(null);

  const openPreview = useCallback(() => {
    previewRef.current?.showModal();
    document.documentElement.classList.add("mentor-dialog-open");
  }, []);
  const closePreview = useCallback(() => {
    previewRef.current?.close();
  }, []);
  // Fires on Escape and on `.close()` alike — the one place scroll-lock needs to come off.
  const handlePreviewClose = useCallback(() => {
    document.documentElement.classList.remove("mentor-dialog-open");
  }, []);

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = (await aiVisionControllerNote()) as unknown as
        | { data?: VisionNoteDto }
        | VisionNoteDto;
      const dto =
        (res as { data?: VisionNoteDto }).data ?? (res as VisionNoteDto);
      if (dto?.note) setNote(dto.note);
    } catch {
      /* Premium enhancement; silent fallback to the plain goal. */
    } finally {
      setGenerating(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    coachingControllerGetVision()
      .then((res) => {
        if (!active) return;
        const dto =
          (res as unknown as { data?: VisionDto | null })?.data ??
          (res as unknown as VisionDto | null);
        setVision(dto ?? null);
        setNote(dto?.aiNote ?? null);
      })
      .catch(() => {
        /* card stays in empty state */
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Resolve premium + generate the note when a goal exists but has no cached note yet.
  useEffect(() => {
    if (!vision) return;
    let active = true;
    aiChatControllerGetAccess()
      .then((res) => {
        if (!active) return;
        const access =
          (res as unknown as { data?: CoachAccessDto }).data ??
          (res as unknown as CoachAccessDto);
        const isPremium = access?.mode === "PREMIUM";
        setPremium(isPremium);
        if (isPremium && vision.aiNote == null) void generate();
      })
      .catch(() => {
        if (active) setPremium(false);
      });
    return () => {
      active = false;
    };
  }, [vision, generate]);

  // Avoid a layout flash before we know whether a goal exists.
  if (!loaded) return null;

  return (
    <>
      <Card>
        <SectionHeading>{translate("card_title")}</SectionHeading>

        {vision ? (
          <div className="mt-4 flex flex-col gap-3">
            {/*
            A published board replaces the plain heading with the thing the user actually made —
            the goal title and city already read inside it, so repeating them as text underneath
            was the same fact twice. Rendered through the same `BoardStage` the editor uses — a
            second, card-sized renderer would drift, and the drift would only ever surface as "my
            board looks wrong here". No stored thumbnail: the document is already in this response.
            A click opens the full-size preview rather than jumping straight to editing — glancing
            at a goal shouldn't cost a navigation.
          */}
            {vision.board?.status === "PUBLISHED" ? (
              <button
                type="button"
                onClick={openPreview}
                aria-label={translate("board.preview_label")}
                className="cursor-pointer rounded-[var(--radius-card)] text-left transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
              >
                <BoardFrame frame={vision.board.frame}>
                  <BoardStage doc={vision.board} />
                </BoardFrame>
              </button>
            ) : null}

            {generating ? (
              <p
                className="text-sm"
                role="status"
                style={{ color: "var(--color-secondary)" }}
              >
                {translate("generating")}
              </p>
            ) : premium && note ? (
              <motion.div
                role="status"
                className="flex flex-col gap-2"
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                {/* Sparkles marks AI-authored content, matching the coach module's own convention.
                    Quiet on purpose: this is a provenance label for the sentence below it, not an
                    action — the note itself stays glanceable rather than hidden behind a click. */}
                <Chip size="sm" className="inline-flex w-fit items-center gap-1">
                  <Sparkles aria-hidden size={11} />
                  {translate("coach_chip")}
                </Chip>
                <p className="text-sm" style={{ color: "var(--color-body)" }}>
                  {note}
                </p>
              </motion.div>
            ) : premium === false ? (
              <button
                type="button"
                onClick={() => router.push("/subscription")}
                className="text-left text-sm underline"
                style={{ color: "var(--color-secondary)" }}
              >
                {translate("premium_nudge")}
              </button>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/vision-board"
                className="text-sm underline"
                style={{ color: "var(--color-main)" }}
              >
                {translate("edit")}
              </Link>
              <Link
                href="/vision-board/board"
                className="text-sm underline"
                style={{ color: "var(--color-secondary)" }}
              >
                {vision.board
                  ? translate("board.continue_cta")
                  : translate("board.open_cta")}
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
              {translate("empty")}
            </p>
            <Link
              href="/vision-board"
              className="inline-flex min-h-11 w-fit items-center rounded-[var(--radius-card)] border px-4 text-sm font-semibold transition-colors hover:bg-[color-mix(in_srgb,var(--color-surface)_60%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-reduce:transition-none"
              style={{
                color: "var(--color-main)",
                borderColor:
                  "color-mix(in srgb, var(--color-main) 15%, transparent)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {translate("set_cta")}
            </Link>
          </div>
        )}
      </Card>

      {/*
        Native `<dialog>`, not the imperative DialogProvider/BottomSheet primitives — those render
        fixed title+message+button templates and have no slot for arbitrary content like a live
        `BoardStage`. `showModal()` puts it in the top layer, so placement in the tree doesn't
        matter and background stacking contexts can't clip it. Escape and backdrop-click close it
        for free; only the scroll-lock class and the explicit close button are ours to wire up.
      */}
      {vision?.board?.status === "PUBLISHED" ? (
        <dialog
          ref={previewRef}
          onClose={handlePreviewClose}
          onClick={(event) => {
            if (event.target === event.currentTarget) closePreview();
          }}
          aria-label={translate("card_title")}
          // Full-viewport, not a centered card: `m-0` cancels the UA auto-centering margin, and
          // `max-w-none`/`max-h-none` cancel its `calc(100% - 6px - 2*3px)` cap — both are needed
          // or the dialog stays boxed to its content size.
          className="m-0 h-dvh max-h-none w-dvw max-w-none bg-[var(--color-bg)] p-0"
        >
          <div className="animate-dialog-enter motion-reduce:animate-none relative flex h-full w-full items-center justify-center p-6">
            <button
              type="button"
              onClick={closePreview}
              aria-label={translate("board.preview_close")}
              className="absolute end-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-main)] shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              <X aria-hidden size={18} />
            </button>
            {vision?.board ? (
              // Bounded on both axes (width AND height×3:2), not just `max-w-full`: BoardStage
              // derives its own height from width via `aspect-ratio`, so on a wide, short
              // viewport an unbounded width would push the board taller than the screen.
              <div
                style={{
                  width: "100%",
                  maxWidth: "min(92vw, calc(88dvh * 1.5))",
                }}
              >
                <BoardFrame frame={vision.board.frame}>
                  <BoardStage doc={vision.board} />
                </BoardFrame>
              </div>
            ) : null}
          </div>
        </dialog>
      ) : null}
    </>
  );
}
