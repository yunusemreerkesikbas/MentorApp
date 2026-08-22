"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import type { NotebookEntryDto } from "@mentor/types";
import { REVIEW_CARD_WIDTH } from "./notebook-review-card";

/**
 * The deck seen from above: the cards themselves, stacked, each showing only its title band.
 *
 * It was a list of rows — thumbnail, title, error type — grouped under subject headings. That is a
 * perfectly good list and the wrong object: the student is holding a deck of cards, and the way you
 * find a card in a deck is by fanning it and reading the edges, not by consulting an index of it.
 * The stack says "there are nine of these and you are on the fourth" in one glance, which is the
 * only question this screen exists to answer.
 *
 * Deliberately still not a checklist. There is no answer control on any slab: tapping one takes you
 * to that card, where the question is, and the answer is given there. Ticking a question you never
 * looked at is the one thing this feature cannot survive.
 *
 * The subject grouping that used to live in headings is gone from here entirely — the deck arrives
 * already ordered so one subject's cards sit together (`bySubject`). Headings between the slabs
 * would cut the deck into three piles anyway; the illusion only holds while the stack is continuous.
 */

export interface NotebookReviewListProps {
  /** The deck as it was when the panel opened, already ordered so one subject's cards sit together. */
  entries: NotebookEntryDto[];
  /** By id, not position — the panel and the list must agree on which card is which. */
  currentId: string | null;
  answered: ReadonlySet<string>;
  onPick: (entryId: string) => void;
}

/**
 * How much of each slab the next one covers.
 *
 * The gap left over is the whole design: too little and the titles collide, too much and the slabs
 * stop reading as one deck and become a list with rounded rows again. At a 64px slab this leaves a
 * 44px band — still a legal touch target, and enough for one line of title.
 */
const STACK_OVERLAP_PX = 20;

/**
 * The gap between one card landing and the next — the deck deals itself when the list opens.
 *
 * The stack used to appear whole, which made the switch from card to list a hard cut: nine slabs
 * where a moment ago there was one card. Dealing them says the thing the view is for — this is your
 * deck, and there are this many left in it — in the half second before the student reads a word.
 *
 * 45ms is picked from the deck's own length. Nine cards land in 400ms of stagger, which is under the
 * ~500ms where a sequence stops reading as one motion and becomes a queue you wait for; a fifty-card
 * deck would need the cap this does not have, and a fifty-card review day is a different problem.
 */
const DEAL_STAGGER_S = 0.045;

/**
 * Each card arrives from below and behind, along the same Z axis every other lift on this pile
 * uses — it slides *into* the stack rather than fading in on top of it. Reduced motion keeps the
 * stagger's order (it is information: this is the deck, dealt in order) and drops the travel.
 */
const dealVariants: Variants = {
  hidden: { opacity: 0, y: 24, z: -90 },
  shown: {
    opacity: 1,
    y: 0,
    z: 0,
    transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
  },
};

const dealVariantsReduced: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.15 } },
};

export function NotebookReviewList({
  entries,
  currentId,
  answered,
  onPick,
}: NotebookReviewListProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      // `overflow-x-clip` is not decoration. `overflow-y-auto` on its own leaves the x axis
      // `visible`, which CSS then computes to `auto` — so the lifted card poked out by a few
      // pixels and the deck grew a horizontal scrollbar across its foot.
      className={`max-h-[62vh] ${REVIEW_CARD_WIDTH} overflow-y-auto overflow-x-clip px-4 pb-10 pt-2`}
      style={{
        // Real perspective, not a stack of flat slabs: the deck is tilted away from the reader so
        // the cards further up genuinely recede. `perspective` lives on the scroll container and
        // the rotation on the list inside it, because a transformed element cannot also be the
        // thing that scrolls — the two fight over the same box.
        perspective: "1100px",
        perspectiveOrigin: "50% 0%",
        // The fade is what sells "the deck continues past the edge" — and unlike the old flat
        // list, this view always has something meaningful under the mask, because the slab there
        // is a card and not a heading. Softer at the top, where the cards slide out of view.
        maskImage:
          "linear-gradient(to bottom, transparent 0, #000 32px, #000 calc(100% - 24px), transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0, #000 32px, #000 calc(100% - 24px), transparent 100%)",
      }}
    >
      <motion.ol
        className="flex flex-col"
        initial="hidden"
        animate="shown"
        variants={{
          shown: { transition: { staggerChildren: DEAL_STAGGER_S } },
        }}
        style={{
          transformStyle: "preserve-3d",
          // Hinged at the top edge, so the near end of the deck is the one under the reader's
          // thumb. 10° is the whole budget: past about 14° the titles start to foreshorten into
          // an unreadable squash, and this has to stay a list you can read, not a diorama.
          transform: "rotateX(10deg)",
          transformOrigin: "50% 0%",
        }}
      >
        {entries.map((entry, position) => (
          <StackCard
            key={entry.id}
            entry={entry}
            first={position === 0}
            // Later cards sit on top of earlier ones, the way a dealt pile does. Without this the
            // browser's paint order does the opposite and every slab is tucked *behind* the one
            // above it, which reads as a list of tabs rather than a stack.
            depth={position}
            current={entry.id === currentId}
            done={answered.has(entry.id)}
            variants={reduceMotion ? dealVariantsReduced : dealVariants}
            onPick={() => onPick(entry.id)}
          />
        ))}
      </motion.ol>
    </div>
  );
}

/**
 * One card in the pile, seen edge-on.
 *
 * The shadow points *up*, not down: what a slab has to prove is that the card above it is resting
 * on it, and a downward shadow on an overlapping stack lands underneath the neighbour that covers
 * it, where nobody sees it. The current card is lifted out of the pile rather than merely tinted —
 * "where am I" is the one thing that has to survive a glance at nine near-identical slabs.
 */
function StackCard({
  entry,
  first,
  depth,
  current,
  done,
  variants,
  onPick,
}: {
  entry: NotebookEntryDto;
  first: boolean;
  depth: number;
  current: boolean;
  done: boolean;
  variants: Variants;
  onPick: () => void;
}) {
  const t = useTranslations("notebook");
  // Same "Ders · Konu" the card back carries, so the two never name the same card differently.
  const label =
    [entry.subjectName, entry.topicName].filter(Boolean).join(" · ") ||
    t("card_unlabelled");

  return (
    <motion.li
      variants={variants}
      // Every lift on this pile happens along Z, the axis the deck is tilted on: a card rises out
      // of the stack towards the reader instead of sliding up the page. `scale` did that job in two
      // dimensions and cost a horizontal scrollbar; Z is free, because the perspective that makes a
      // raised card look bigger is the one the whole pile already sits in.
      //
      // On the `li`, not the button, because Z only exists inside the `ol`'s 3D context — and all
      // three states live in one class string so the hover cannot be overwritten by an inline
      // transform. The current card rises further on hover rather than dropping to the hover value.
      //
      // `transition-[translate]`, not `transition-transform`: Tailwind's `translate-z-*` writes the
      // standalone `translate` property, so a transform transition watches a property that never
      // changes and the card would snap up with no travel at all. That split is also why the deal
      // animation and the hover lift can share this element without fighting — Framer writes
      // `transform`, the hover writes `translate`, and CSS composes the two.
      className={`relative transition-[translate] duration-200 ease-out motion-reduce:transition-none ${
        current ? "translate-z-[34px]" : ""
      } ${
        done
          ? ""
          : current
            ? "hover:translate-z-[50px] focus-within:translate-z-[50px]"
            : "hover:translate-z-[24px] focus-within:translate-z-[24px]"
      }`}
      style={{
        marginTop: first ? 0 : -STACK_OVERLAP_PX,
        zIndex: current ? 999 : depth,
      }}
    >
      <button
        type="button"
        disabled={done}
        aria-current={current ? "true" : undefined}
        onClick={onPick}
        // No lift of its own: the `li` above owns that, and a button sliding up inside a card that
        // is already rising towards the reader reads as two things moving, not one card.
        className="flex min-h-16 w-full cursor-pointer items-center gap-2 rounded-[var(--radius-card)] px-4 pb-5 pt-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:cursor-default"
        style={{
          backgroundColor: current
            ? "var(--color-accent-soft)"
            : "var(--color-surface)",
          border: `1px solid color-mix(in srgb, var(--color-main) ${
            current ? "22%" : "10%"
          }, transparent)`,
          boxShadow: current
            ? "0 -10px 26px -8px rgba(0,0,0,0.45), 0 14px 30px -12px rgba(0,0,0,0.5)"
            : "0 -8px 18px -10px rgba(0,0,0,0.35)",
          opacity: done ? 0.45 : 1,
        }}
      >
        <span
          className="min-w-0 flex-1 truncate text-center text-sm font-bold uppercase tracking-wide"
          style={{ color: "var(--color-main)" }}
        >
          {label}
        </span>
        {/* Absolute so it cannot shove the title off centre: the titles have to line up down the
            pile, and a check on three of nine slabs would nudge exactly those three. Inset to the
            same asymmetric padding as the label — centring it on the whole slab would put it in the
            strip the next card covers. */}
        {done ? (
          <span className="absolute bottom-5 right-4 top-3 flex items-center">
            <Check
              aria-label={t("review_list_done")}
              size={16}
              strokeWidth={2.5}
              style={{ color: "var(--color-success)" }}
            />
          </span>
        ) : null}
      </button>
    </motion.li>
  );
}
