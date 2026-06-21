"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { CoachAccessDto, VisionDto, VisionNoteDto } from "@mentor/types";
import {
  aiChatControllerGetAccess,
  aiVisionControllerNote,
  coachingControllerGetVision,
} from "@mentor/api-client";
import { Card, Chip, SectionHeading } from "@mentor/ui";
import { Link, useRouter } from "@/i18n/navigation";

/**
 * Vision/goal board ("hayal/hedef panosu") panel card. Self-fetches the goal; free tier sees the
 * goal + a premium nudge, premium users additionally get a cached AI motivation note. Editing lives
 * on the dedicated `/hedef` page (no nav tab).
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

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = (await aiVisionControllerNote()) as unknown as
        | { data?: VisionNoteDto }
        | VisionNoteDto;
      const dto = (res as { data?: VisionNoteDto }).data ?? (res as VisionNoteDto);
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
    <Card>
      <SectionHeading subtitle={translate("card_subtitle")}>
        {translate("card_title")}
      </SectionHeading>

      {vision ? (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-lg font-bold"
              style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
            >
              {vision.goalTitle}
            </span>
            {vision.targetCity ? <Chip>{vision.targetCity}</Chip> : null}
          </div>
          {vision.motivation ? (
            <p className="text-sm" style={{ color: "var(--color-body)" }}>
              {vision.motivation}
            </p>
          ) : null}

          {generating ? (
            <p className="text-sm" role="status" style={{ color: "var(--color-secondary)" }}>
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
              <Chip>{translate("coach_chip")}</Chip>
              <p className="text-sm" style={{ color: "var(--color-body)" }}>
                {note}
              </p>
            </motion.div>
          ) : premium === false ? (
            <button
              type="button"
              onClick={() => router.push("/abonelik")}
              className="text-left text-sm underline"
              style={{ color: "var(--color-secondary)" }}
            >
              {translate("premium_nudge")}
            </button>
          ) : null}

          <Link
            href="/hedef"
            className="text-sm underline"
            style={{ color: "var(--color-main)" }}
          >
            {translate("edit")}
          </Link>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm" style={{ color: "var(--color-secondary)" }}>
            {translate("empty")}
          </p>
          <Link
            href="/hedef"
            className="flex min-h-[44px] w-fit items-center rounded-[var(--radius-card)] px-4 py-2 text-sm font-bold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            style={{
              backgroundColor: "var(--color-btn)",
              color: "#fff",
              boxShadow: "var(--shadow-card)",
              fontFamily: "var(--font-body)",
            }}
          >
            {translate("set_cta")}
          </Link>
        </div>
      )}
    </Card>
  );
}
