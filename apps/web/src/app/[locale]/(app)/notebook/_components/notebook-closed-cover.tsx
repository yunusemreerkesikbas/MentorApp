"use client";

import { useState } from "react";
import type { NotebookCoverDoc, NotebookSummaryDto } from "@mentor/types";
import { DeskBackdrop } from "@/components/notebook-desk/desk-backdrop";
import { NotebookBook } from "@/components/notebook-desk/notebook-book";
import { DEFAULT_COVER } from "@/components/notebook/notebook-surface";

/** Upright and turned a touch towards the reader: the pose the book is held in, not lying flat. */
const HELD_POSE = "perspective(1800px) rotateX(5deg) rotateY(-9deg) rotateZ(-1.2deg)";

/**
 * The closed notebook, held up over the desk it came from.
 *
 * Turning back past the contents page used to land on a flat, page-sized board that read as a
 * blank screen. This is the same object the desk shows and the opening flight lifts
 * (`NotebookBook`): label, sticky note, coil and due tabs, so closing the book looks like the moment
 * it was picked up. The whole book is the control that opens it again; hovering or focusing it
 * lifts it, and the cover glints the way it does on the desk.
 */
export function NotebookClosedCover({
  summary,
  cover,
  title,
  pageCount,
  dueCount,
  meta,
  dueLabel,
  openLabel,
  onOpen,
}: {
  summary: NotebookSummaryDto | null;
  cover: NotebookCoverDoc | null;
  title: string;
  pageCount: number;
  dueCount: number;
  /** "10 sayfa", already translated. */
  meta: string;
  /** "Bugün 3 tekrar", or null when nothing is due. */
  dueLabel: string | null;
  openLabel: string;
  onOpen: () => void;
}) {
  const [lifted, setLifted] = useState(false);
  const chosen = cover ?? DEFAULT_COVER;
  const kind = summary?.kind ?? "MISTAKE";
  const subject =
    kind === "CUSTOM" && summary?.subjectName
      ? { key: summary.subjectRef ?? summary.subjectName, name: summary.subjectName }
      : null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={openLabel}
      className="nb-closed-cover"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      onPointerEnter={() => setLifted(true)}
      onPointerLeave={() => setLifted(false)}
      onFocus={() => setLifted(true)}
      onBlur={() => setLifted(false)}
    >
      <div className="nb-closed-cover-book">
        <NotebookBook
          title={title}
          kind={kind}
          cover={{ color: chosen.color, material: chosen.material }}
          pageCount={pageCount}
          dueCount={dueCount}
          subject={subject}
          meta={meta}
          dueLabel={dueLabel}
          lifted={lifted}
          shadow
          transform={HELD_POSE}
        />
      </div>
    </div>
  );
}

/**
 * The desk behind the closed book, out of focus: the room it was lifted from, so the cover is
 * seen in the same place the opening flight showed it rather than on an empty page.
 */
export function NotebookCoverRoom() {
  return (
    <div aria-hidden="true" className="mentor-notebook-desk desk-scene nb-cover-room">
      <DeskBackdrop />
      <div className="nb-cover-room-scrim" />
    </div>
  );
}
