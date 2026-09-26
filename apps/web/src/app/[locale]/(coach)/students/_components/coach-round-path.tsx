"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { MentorshipRiskFlag } from "@mentor/types";
import { PATH_NODE_BASE, PATH_NODE_TONE, PathItem } from "@/components/panel/path-item";
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu";
import { useRouter } from "@/i18n/navigation";
import { firstName } from "@/lib/greeting";
import { CoachCheck } from "@/components/mentorship/coach-check";
import { COACH_PROGRESS } from "@/components/mentorship/coach-motion";
import { daysSince } from "../../_components/mentorship-format";
import { RISK_FLAG_HUE } from "../../_components/risk-chip";
import { initialsOf } from "../../_components/student-avatar";
import type { CoachRound, RoundNode } from "./coach-round-model";

type T = ReturnType<typeof useTranslations<"mentorship">>;

/** The coach's tones on the path anatomy: ink for the seen, the soft well for the waiting. */
const TONE = {
  done: "size-12 bg-[var(--coach-accent)] text-[var(--color-bg)] shadow-[0_4px_0_color-mix(in_srgb,var(--coach-accent),black_30%)] sm:size-14",
  upcoming:
    "size-12 bg-[var(--coach-accent-soft)] text-[var(--coach-accent-ink)] shadow-[0_4px_0_var(--play-line)] sm:size-14",
  more: "size-12 bg-[var(--play-track)] text-[var(--color-secondary)] shadow-[0_4px_0_var(--play-line)] sm:size-14",
  end: "size-12 border-2 border-dashed border-[var(--play-line)] bg-[var(--color-surface)] text-[var(--color-secondary)] sm:size-14",
  endReached:
    "size-12 bg-[var(--coach-accent)] text-[var(--color-bg)] shadow-[0_4px_0_color-mix(in_srgb,var(--coach-accent),black_30%),0_0_0_8px_var(--coach-accent-soft)] sm:size-14",
} as const;

/** "17 gün sessiz" for a silent student; the flag's own name otherwise. */
function reasonOf(node: RoundNode, t: T): string {
  const last = node.row.metrics?.lastActiveDate;
  if (node.flag === MentorshipRiskFlag.INACTIVE && last) {
    return t("round_node_silent_days", { count: daysSince(last) });
  }
  return node.flag ? t(`flag_${node.flag}`) : "";
}

/**
 * Today's round as a path (DESIGN.md §6.1): who the coach has seen, who is next (the only big
 * node), who waits after them, and the finish. A node opens a small menu rather than acting on the
 * tap, like the panel path, so a thumb brushing the path never marks a student by accident.
 *
 * Marking a student is the round's progress moment (Durak F, under 400 ms): the node draws its ✓,
 * the connector fills toward the next student, whose node grows while the "Sıradaki" tip glides
 * over to it.
 */
export function CoachRoundPath({
  round,
  busyId,
  celebrate,
  onMark,
}: {
  round: CoachRound;
  busyId: string | null;
  /** Play the finish node's one-time "tur tamam" moment. */
  celebrate: boolean;
  onMark: (studentId: string, attended: boolean) => void;
}) {
  const t = useTranslations("mentorship");
  const reduceMotion = useReducedMotion();
  const lead = round.hiddenBefore > 0 ? 1 : 0;
  const complete = round.kind === "complete";
  const reachedUntil = round.nodes.findIndex((node) => node.state !== "done");

  return (
    <ol
      className="-mx-5 flex overflow-x-auto px-5 pb-1 pt-9 [scrollbar-width:none] sm:mx-0 sm:overflow-visible sm:px-0"
      aria-label={t("round_label")}
    >
      {round.hiddenBefore > 0 ? (
        <PathItem
          index={0}
          reached
          tone="coach"
          title={t("round_node_earlier", { count: round.hiddenBefore })}
          node={
            <span className={`${PATH_NODE_BASE} ${TONE.done} text-sm font-black`} aria-hidden>
              +{round.hiddenBefore}
            </span>
          }
        />
      ) : null}

      {round.nodes.map((node, offset) => {
        const index = offset + lead;
        const reason = reasonOf(node, t);
        return (
          <PathItem
            key={node.row.studentId}
            index={index}
            // The connector into the next student is drawn in ink: the coach has walked up to them.
            reached={reachedUntil === -1 || offset <= reachedUntil}
            tone="coach"
            animateReach
            title={firstName(node.row.studentDisplayName)}
            meta={
              node.state === "done" ? (
                t("round_node_seen")
              ) : (
                <span className="inline-flex max-w-full items-center gap-1.5">
                  {node.flag ? (
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: `var(${RISK_FLAG_HUE[node.flag]})` }}
                    />
                  ) : null}
                  <span className="truncate">{reason}</span>
                </span>
              )
            }
            node={
              <StudentNode
                node={node}
                reason={reason}
                busy={busyId === node.row.studentId}
                onMark={onMark}
              />
            }
          />
        );
      })}

      {round.hiddenAfter > 0 ? (
        <PathItem
          index={1}
          reached={false}
          tone="coach"
          title={t("round_node_more_title")}
          meta={t("round_node_more_meta", { count: round.hiddenAfter })}
          node={
            <a
              href="#ogrenciler"
              className={`${PATH_NODE_BASE} ${TONE.more} text-sm font-black`}
              aria-label={t("round_node_more_aria", { count: round.hiddenAfter })}
            >
              +{round.hiddenAfter}
            </a>
          }
        />
      ) : null}

      <PathItem
        index={1}
        reached={complete}
        tone="coach"
        animateReach
        title={t("round_node_end")}
        node={
          <motion.span
            // framer-motion reads `initial` only on mount: a round finished on this screen must
            // draw the node anew, or its moment is spent without playing.
            key={celebrate ? "celebrate" : "still"}
            role="img"
            aria-label={complete ? t("round_node_end") : t("round_node_end_open")}
            className={`${PATH_NODE_BASE} ${complete ? TONE.endReached : TONE.end}`}
            initial={celebrate && !reduceMotion ? { scale: 0.6 } : false}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <Flag className="size-5" strokeWidth={2.2} aria-hidden />
          </motion.span>
        }
      />
    </ol>
  );
}

function StudentNode({
  node,
  reason,
  busy,
  onMark,
}: {
  node: RoundNode;
  reason: string;
  busy: boolean;
  onMark: (studentId: string, attended: boolean) => void;
}) {
  const t = useTranslations("mentorship");
  const router = useRouter();
  const { row, state } = node;
  const tone =
    state === "done" ? TONE.done : state === "current" ? PATH_NODE_TONE.current : TONE.upcoming;
  // A node that turns done on this screen draws its ✓; one that loaded done stays still.
  const [loadedDone] = useState(state === "done");

  return (
    // The node's size step (48 ↔ 64 px) animates on this wrapper, not on the button: the button's
    // own press transition must not fight framer over `transform`. Size only: when the window
    // shifts, the stops re-slot at once instead of sliding under their static titles.
    <motion.div layout="size" transition={COACH_PROGRESS}>
      <PopoverMenu
        align="left"
        menuClassName="w-56 py-1"
        trigger={({ open, setOpen, menuId }) => (
          <button
            type="button"
            className={`${PATH_NODE_BASE} ${tone} cursor-pointer font-black disabled:cursor-wait ${state === "current" ? "text-title" : "text-body-sm"}`}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? menuId : undefined}
            aria-label={[row.studentDisplayName, t(`round_node_state_${state}`), state === "done" ? null : reason]
              .filter(Boolean)
              .join(", ")}
            disabled={busy}
            onClick={() => setOpen(!open)}
            data-testid="round-node"
          >
            {state === "current" ? (
              // One tip on the path; `layoutId` carries it from the student just seen to the next.
              <motion.span
                layoutId="round-next-tip"
                transition={COACH_PROGRESS}
                className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-card)] border-2 border-[var(--play-line)] bg-[var(--color-surface)] px-2.5 py-0.5 text-xs font-black text-[var(--play-selected-ink)]"
                data-testid="round-next-tip"
              >
                {t("round_node_next")}
              </motion.span>
            ) : null}
            {state === "done" ? (
              <CoachCheck draw={!loadedDone} className="size-6" />
            ) : (
              <span aria-hidden>{initialsOf(row.studentDisplayName)}</span>
            )}
            {node.flag ? (
              <span
                aria-hidden
                className={`absolute size-4 rounded-full border-[3px] border-[var(--color-surface)] ${state === "current" ? "right-0.5 top-0.5" : "-right-0.5 -top-0.5"}`}
                style={{ backgroundColor: `var(${RISK_FLAG_HUE[node.flag]})` }}
              />
            ) : null}
          </button>
        )}
      >
        <PopoverMenuItem
          onClick={() =>
            router.push(
            { pathname: "/students/[studentId]", params: { studentId: row.studentId } },
            { transitionTypes: ["nav-forward"] },
          )
          }
        >
          {t("round_menu_open")}
        </PopoverMenuItem>
        {state === "done" ? (
          <PopoverMenuItem onClick={() => onMark(row.studentId, false)}>
            {t("round_menu_undo")}
          </PopoverMenuItem>
        ) : (
          <PopoverMenuItem onClick={() => onMark(row.studentId, true)}>
            {t("attention_mark")}
          </PopoverMenuItem>
        )}
      </PopoverMenu>
    </motion.div>
  );
}
