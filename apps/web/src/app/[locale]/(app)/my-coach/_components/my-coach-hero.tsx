"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Info } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { MyCoachDto } from "@mentor/types";
import { CoachAvatar, CoachClaims } from "@/components/mentorship/coach-identity";
import { CompanionBubble } from "@/components/panel/companion-bubble";
import { PANEL_CARD_TITLE, PANEL_HERO } from "@/components/panel/panel-styles";

/** A calm line inside the card: the link stands, but something about it is on hold. */
const CALM =
  "flex items-start gap-2.5 rounded-[var(--radius-card)] bg-[var(--play-selected)] px-3.5 py-3 text-body-sm font-bold text-[var(--color-main)]";

const RISE_EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Who the coach is and what they last said, in the coach ink (DESIGN.md §2.5). `welcome` is the
 * arrival right after the student agreed: Puhu says it once and the disk rises in (under 600 ms,
 * still when motion is reduced); the shell spends the flag so a refresh does not greet again.
 */
export function MyCoachHero({ coach, welcome }: { coach: MyCoachDto; welcome: boolean }) {
  const t = useTranslations("mentorship");
  const format = useFormatter();
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const profile = coach.coachProfile;
  const meta = [
    coach.acceptedAt
      ? t("my_coach_since", {
          date: format.dateTime(new Date(coach.acceptedAt), { day: "numeric", month: "long", year: "numeric" }),
        })
      : null,
    coach.coachUsername ? `@${coach.coachUsername}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const rise = welcome && !reduceMotion;

  return (
    <section aria-labelledby={titleId} className={PANEL_HERO}>
      {welcome ? (
        <CompanionBubble puhu="happy" text={t("my_coach_welcome", { name: coach.coachDisplayName })} />
      ) : null}

      <div className="flex items-center gap-4">
        <motion.div
          initial={rise ? { opacity: 0, scale: 0.6 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: RISE_EASE }}
        >
          <CoachAvatar name={coach.coachDisplayName} size="xl" />
        </motion.div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-caption font-extrabold text-[var(--coach-accent)]">
            {t("my_coach_eyebrow")}
          </span>
          <h2 id={titleId} className="text-xl font-extrabold leading-snug text-[var(--color-main)]">
            {coach.coachDisplayName}
          </h2>
          {meta ? <span className="text-caption font-semibold text-[var(--color-secondary)]">{meta}</span> : null}
        </div>
      </div>

      {/* An admin stopped this coach (APP-089), or their seats are full: the link stands and nothing
          was ended, but the work is not reaching them, and a coach gone quiet for a reason like
          this otherwise reads as a coach who stopped caring. */}
      {coach.coachStatus != null && coach.coachStatus !== "ACTIVE" ? (
        <p className={CALM}>
          <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-[var(--play-selected-ink)]" strokeWidth={1.75} />
          {t("my_coach_suspended")}
        </p>
      ) : null}
      {coach.seatWaiting ? (
        <p className={CALM}>
          <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-[var(--play-selected-ink)]" strokeWidth={1.75} />
          {t("my_coach_seat_waiting")}
        </p>
      ) : null}

      {/* Re-readable after the fact: who they agreed with, in the words they read at the invite. */}
      {profile === null ? (
        <p className="text-body-sm font-semibold text-[var(--color-secondary)]">{t("coach_profile_unknown")}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          <p className={PANEL_CARD_TITLE}>{profile.headline}</p>
          <p className="whitespace-pre-line text-body-sm font-semibold text-[var(--color-body)]">{profile.bio}</p>
          <CoachClaims claims={profile.claims} />
        </div>
      )}

      {coach.coachNote ? (
        <div className="flex flex-col gap-2">
          {/* A heading, not a label: screen-reader users jump to the coach's note by it. */}
          <h3 className="text-caption font-extrabold text-[var(--color-secondary)]">{t("my_coach_note_title")}</h3>
          <blockquote className="whitespace-pre-line break-words rounded-[var(--radius-card)] bg-[var(--coach-accent-soft)] px-3.5 py-3 text-body-sm font-semibold text-[var(--coach-accent-ink)]">
            {coach.coachNote.body}
          </blockquote>
          <p className="text-caption font-semibold text-[var(--color-secondary)]">
            {t("my_coach_note_since", {
              date: format.dateTime(new Date(coach.coachNote.updatedAt), { day: "numeric", month: "long" }),
            })}
          </p>
        </div>
      ) : null}
    </section>
  );
}
