"use client";

import { useState, type CSSProperties, type Ref } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import type { NotebookEntryDto } from "@mentor/types";
import {
  placementTransform,
  type FanPlacement,
} from "@/lib/notebook-review-fan";
import { CardFront } from "./notebook-review-card";

/**
 * What a card is doing right now. `hand` and `pile` are the open list; the other three are the
 * review card as the panel draws it, which is where the hand is dealt from and folds back to:
 * `top` is the review card itself, `behind` the two tilted blanks under it, `inside` the rest.
 */
export type FanCardRole = "hand" | "pile" | "top" | "behind" | "inside";

/** How this card gets to its new place; null lands it there at once. */
export interface FanCardTiming {
  ms: number;
  delay: number;
  ease: string;
  fadeMs: number;
  fadeDelay: number;
}

interface NotebookReviewFanCardProps {
  entry: NotebookEntryDto;
  role: FanCardRole;
  placement: FanPlacement;
  timing: FanCardTiming | null;
  /** The middle slot, where every card is laid out before its transform moves it. */
  slot: { left: number; top: number; width: number; height: number };
  /**
   * The review card's width. The face is laid out at that size and shrunk to the slot, so the card
   * that grows back into the review card is the review card's own front, not a blurry enlargement.
   */
  faceWidth: number;
  hoverLift: number;
  /** The card the deck is on — what "Karta dön" goes back to. */
  current: boolean;
  /** The lifted one, and the only one in the tab order. */
  browsed: boolean;
  /** The deck's "3 / 9" chip, shown while this card is the review card. */
  progress: string;
  onPick: () => void;
  buttonRef: Ref<HTMLButtonElement>;
}

/** Face radius and hairline, in face pixels, that land at the review card's own on screen. */
const RADIUS_PX = 10;
const HAIRLINE_PX = 1;

/**
 * Shadows on the dialog's scrim. `--shadow-card` is tuned for a light page and all but vanishes on
 * the 70% black behind the deck, so the hand's own depth uses darker literal values, the same way
 * the controls floating on that scrim do.
 */
const SHADOW_HAND = "0 10px 22px -12px rgba(0,0,0,0.6)";
const SHADOW_LIFTED = "0 22px 40px -14px rgba(0,0,0,0.7)";
const SHADOW_PILE = "0 12px 24px -10px rgba(0,0,0,0.6)";

/**
 * One card of the fan: the real front of the question, "Ders · Konu" on a band underneath.
 *
 * The band is the only label a hand card carries. No error type: that is on the back of the card
 * because it gives the answer away, and a list that printed it on every front would undo the flip.
 * A card with no photo shows its text front, the same one the review card shows; the note stays on
 * the back for the same reason.
 *
 * Still not a checklist. A tap takes the student to the card, where the question is; an answered
 * card sits on the pile, disabled, so nothing here can review a card twice.
 */
export function NotebookReviewFanCard({
  entry,
  role,
  placement,
  timing,
  slot,
  faceWidth,
  hoverLift,
  current,
  browsed,
  progress,
  onPick,
  buttonRef,
}: NotebookReviewFanCardProps) {
  const t = useTranslations("notebook");
  const [photoFailed, setPhotoFailed] = useState(false);
  // Same "Ders · Konu" the card back carries, so the two never name the same card differently.
  const label =
    [entry.subjectName, entry.topicName].filter(Boolean).join(" · ") ||
    t("card_unlabelled");
  const hand = role === "hand";
  const done = role === "pile";
  const scale = placement.scale;

  const move = timing
    ? `${timing.ms}ms ${timing.ease} ${timing.delay}ms`
    : "0s";
  const fade = (ms: number, delay = 0) =>
    timing ? `opacity ${ms}ms ease-out ${delay}ms` : "none";

  const shadow =
    role === "hand"
      ? browsed
        ? SHADOW_LIFTED
        : SHADOW_HAND
      : role === "pile"
        ? SHADOW_PILE
        : role === "inside"
          ? "none"
          : "var(--shadow-card)";

  return (
    <li
      className={`absolute z-[var(--fan-z)] ${hand ? "hover:z-[950]" : ""}`}
      style={
        {
          "--fan-z": placement.z,
          left: slot.left,
          top: slot.top,
          width: slot.width,
          height: slot.height,
          transform: placementTransform(placement),
          opacity: placement.opacity,
          transition: timing
            ? `transform ${move}, opacity ${timing.fadeMs}ms ease-out ${timing.fadeDelay}ms`
            : "none",
          // A card that has faded out past the window, or is mid-fold, must not take a tap meant
          // for the card under it.
          pointerEvents: hand && placement.opacity > 0 ? undefined : "none",
        } as CSSProperties
      }
    >
      <button
        ref={buttonRef}
        type="button"
        disabled={done}
        tabIndex={browsed && hand ? 0 : -1}
        aria-label={done ? `${label}, ${t("review_list_done")}` : label}
        aria-current={current ? "true" : undefined}
        onClick={onPick}
        className="group block size-full cursor-pointer outline-none disabled:cursor-default"
      >
        <span
          // The pointer's own lift, along the card's tilt: the `li` above is already rotated.
          className={`block size-full transition-[translate] duration-200 ease-out motion-reduce:transition-none ${
            hand ? "group-hover:translate-y-[var(--fan-hover)]" : ""
          }`}
          style={{ "--fan-hover": `${-hoverLift}px` } as CSSProperties}
        >
          <span
            className="relative block size-full overflow-hidden outline-offset-4 group-focus-visible:outline-2 group-focus-visible:outline-[var(--color-focus-ring)]"
            style={{
              // Divided by the card's scale so the corner and hairline read the same at hand size
              // and at review-card size — and land exactly on the review card's own at the end of a
              // fold. Transitioned with the transform, or the corners pop when the swap happens.
              borderRadius: RADIUS_PX / scale,
              border: `${HAIRLINE_PX / scale}px solid color-mix(in srgb, var(--color-main) 10%, transparent)`,
              backgroundColor: "var(--color-surface)",
              boxShadow: current && hand ? `0 0 0 3px var(--color-accent), ${shadow}` : shadow,
              transition: timing
                ? `border-radius ${move}, border-width ${move}, box-shadow 300ms ease-out`
                : "none",
            }}
          >
            <span
              aria-hidden
              className="absolute left-0 top-0 origin-top-left"
              style={{
                width: faceWidth,
                height: faceWidth * 1.25,
                transform: `scale(${slot.width / faceWidth})`,
              }}
            >
              <CardFront
                entry={entry}
                photo={Boolean(entry.url) && !photoFailed}
                onPhotoError={() => setPhotoFailed(true)}
                priority={false}
              />
              {/* The panel's own chip, drawn where it sits on the review card, so the hand-over
                  in either direction keeps it in place instead of blinking. */}
              <span
                className="absolute left-2 top-2 rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{
                  color: "var(--color-main)",
                  backgroundColor:
                    "color-mix(in srgb, var(--color-surface) 80%, transparent)",
                  boxShadow: "var(--shadow-card)",
                  opacity: role === "top" ? 1 : 0,
                  transition: fade(role === "top" ? 300 : 120),
                }}
              >
                {progress}
              </span>
            </span>

            {/* The panel draws the two cards behind the review card blank, so the cards dealt from
                there start blank too and turn face up on the way out. */}
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                backgroundColor: "var(--color-surface)",
                opacity: role === "behind" ? 1 : 0,
                transition: fade(200, timing?.delay ?? 0),
              }}
            />

            {/* Left-aligned: every card but the last has its right side under the next one, so
                a centred label lost its end ("Tarih · Osman…") exactly where it was covered. */}
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 flex items-center px-2.5"
              style={{
                height: Math.round(Math.min(30, Math.max(24, slot.height * 0.14))),
                backgroundColor: current
                  ? "var(--color-accent-soft)"
                  : "color-mix(in srgb, var(--color-surface) 96%, transparent)",
                borderTop:
                  "1px solid color-mix(in srgb, var(--color-main) 8%, transparent)",
                opacity: hand ? 1 : 0,
                transition: fade(220, hand ? (timing?.delay ?? 0) + 200 : 0),
              }}
            >
              <span
                className="min-w-0 truncate text-micro font-extrabold"
                style={{ color: "var(--color-main)" }}
              >
                {label}
              </span>
            </span>

            <span
              aria-hidden
              className="absolute grid place-items-center rounded-full"
              style={{
                right: slot.width * 0.08,
                top: slot.width * 0.08,
                width: Math.max(32, slot.width * 0.22),
                height: Math.max(32, slot.width * 0.22),
                backgroundColor: "var(--color-success)",
                color: "var(--color-btn-label)",
                opacity: done ? 1 : 0,
                transition: fade(200),
              }}
            >
              <Check aria-hidden size="58%" strokeWidth={3.5} />
            </span>
          </span>
        </span>
      </button>
    </li>
  );
}
