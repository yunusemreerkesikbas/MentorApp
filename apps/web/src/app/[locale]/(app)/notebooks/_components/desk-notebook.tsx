"use client";

import type { MouseEvent as ReactMouseEvent } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { NotebookSummaryDto } from "@mentor/types";
import { Link } from "@/i18n/navigation";
import { NotebookBook } from "@/components/notebook-desk/notebook-book";
import {
  DESK_NUDGE,
  DESK_PERSPECTIVE_PX,
  DESK_TILT_DEG,
  deskPose,
} from "@/lib/notebook-desk";
import { DeskDust } from "./desk-dust";

/** How the pose changes when a book is picked up a little: it tilts towards you and squares up. */
const LIFTED_TILT_DEG = DESK_TILT_DEG - 4;
const LIFTED_SPIN_SHARE = 0.6;

export function notebookHref(item: NotebookSummaryDto) {
  return item.kind === "MISTAKE"
    ? ("/notebook" as const)
    : ({
        pathname: "/notebooks/[notebookId]" as const,
        params: { notebookId: item.id },
      } as const);
}

/** The pose a desk book is drawn in, as the transform its 3D container takes. */
export function deskBookTransform(rotateX: number, rotateZ: number): string {
  return `perspective(${DESK_PERSPECTIVE_PX}px) rotateX(${rotateX}deg) rotateZ(${rotateZ}deg)`;
}

export interface DeskNotebookProps {
  item: NotebookSummaryDto;
  title: string;
  lifted: boolean;
  /** Just created: falls onto the desk instead of simply being there. */
  dropping: boolean;
  /** Lifted off by the opening overlay; the flying copy is drawn in its place. */
  away: boolean;
  frameRef: (element: HTMLElement | null) => void;
  onActive: (id: string | null) => void;
  onOpen: (
    event: ReactMouseEvent<HTMLAnchorElement>,
    item: NotebookSummaryDto,
  ) => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * One notebook lying on the desk.
 *
 * An `<article>` whose heading is the title printed on the book's own label, wrapped in a real link
 * to the editor: middle-click, a new tab and no-JS all still work, and a plain click is what the
 * desk turns into the lift-and-open moment.
 */
export function DeskNotebook({
  item,
  title,
  lifted,
  dropping,
  away,
  frameRef,
  onActive,
  onOpen,
  onEdit,
  onDelete,
}: DeskNotebookProps) {
  const t = useTranslations("notebooks");
  const pose = deskPose(item.id);
  const pages = t("pages", { count: item.pageCount });
  const due =
    item.kind === "MISTAKE" && item.dueCount > 0
      ? t("due", { count: item.dueCount })
      : null;
  const label = [title, pages, due, item.subjectName]
    .filter((part): part is string => Boolean(part))
    .join(", ");

  return (
    <article
      className="desk-cell group relative flex justify-center"
      onPointerEnter={() => onActive(item.id)}
      onPointerLeave={() => onActive(null)}
      onFocus={() => onActive(item.id)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onActive(null);
      }}
    >
      <div className="desk-book-slot relative">
        {item.kind === "CUSTOM" ? (
          <div className="desk-cell-actions absolute -end-3 -top-3 z-20 flex rounded-full opacity-100 transition-opacity duration-150 motion-reduce:transition-none [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:pointer-events-auto [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-hover:opacity-100">
            <button
              type="button"
              aria-label={t("edit", { title })}
              onClick={onEdit}
              className="flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              <Pencil aria-hidden size={18} />
            </button>
            <button
              type="button"
              aria-label={t("delete", { title })}
              onClick={onDelete}
              className="flex size-11 items-center justify-center rounded-full text-[var(--color-danger)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              <Trash2 aria-hidden size={18} />
            </button>
          </div>
        ) : null}
        <Link
          href={notebookHref(item)}
          aria-label={t("desk.open", { details: label })}
          onClick={(event) => onOpen(event, item)}
          className="desk-book-link relative block outline-none"
          style={{
            translate: `${(pose.dx * DESK_NUDGE * 100).toFixed(2)}% ${(pose.dy * DESK_NUDGE * 100).toFixed(2)}%`,
            visibility: away ? "hidden" : undefined,
          }}
        >
          <div
            ref={frameRef}
            className={dropping ? "desk-book-frame desk-dropping" : "desk-book-frame"}
          >
            <NotebookBook
              title={title}
              kind={item.kind}
              cover={item.cover}
              pageCount={item.pageCount}
              dueCount={item.dueCount}
              subject={
                item.kind === "CUSTOM" && item.subjectName
                  ? { key: item.subjectRef ?? item.subjectName, name: item.subjectName }
                  : null
              }
              meta={pages}
              dueLabel={due}
              titleAs="h2"
              lifted={lifted}
              shadow
              transform={deskBookTransform(
                lifted ? LIFTED_TILT_DEG : DESK_TILT_DEG,
                lifted ? pose.rotate * LIFTED_SPIN_SHARE : pose.rotate,
              )}
            />
          </div>
          {dropping ? <DeskDust /> : null}
        </Link>
      </div>
    </article>
  );
}

/** The pose `DeskNotebook` draws `item` in right now, for the overlay to start from. */
export function deskBookPose(item: NotebookSummaryDto, lifted: boolean) {
  const pose = deskPose(item.id);
  return {
    rotateX: lifted ? LIFTED_TILT_DEG : DESK_TILT_DEG,
    rotateZ: lifted ? pose.rotate * LIFTED_SPIN_SHARE : pose.rotate,
  };
}
