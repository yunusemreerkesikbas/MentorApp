"use client";

import { useTranslations } from "next-intl";
import type { NotebookContentsDto, NotebookCoverDoc } from "@mentor/types";
import {
  DEFAULT_COVER,
  NotebookSpine,
  PAGE_PERCENT,
} from "@/components/notebook/notebook-surface";
import { NotebookInsideCover } from "@/components/notebook-desk/notebook-book";
import { NotebookContentsPage } from "@/components/notebook-desk/notebook-contents-page";
import type { Side } from "./notebook-shell-layout";

/**
 * The book's first spread: the inside of the front cover, and the contents page facing it.
 *
 * The same two drawings the flying book opens onto (`notebook-opening-overlay.tsx`), at the same
 * proportions, so when the book lets go the page underneath is already the page it was showing.
 */
export function NotebookContentsSpread({
  cover,
  owner,
  contents,
  failed,
  mobileSide,
  onOpenPage,
  onStart,
}: {
  cover: NotebookCoverDoc | null;
  owner: string | null;
  contents: NotebookContentsDto | null;
  failed: boolean;
  /** On a phone one side shows at a time; null shows both. */
  mobileSide: Side | null;
  onOpenPage: (pageIndex: number) => void;
  onStart: () => void;
}) {
  const t = useTranslations("notebook");
  const style = cover ?? DEFAULT_COVER;
  const inside = (
    <div
      className="relative h-full"
      style={{
        containerType: "inline-size",
        width: mobileSide ? "100%" : `${PAGE_PERCENT}%`,
      }}
    >
      {/* Rounded in the book's own units, which only resolve inside the container above. */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          borderRadius: "4.2cqw 1.15cqw 1.15cqw 4.2cqw",
          boxShadow: "var(--notebook-page-shadow)",
        }}
      >
        <NotebookInsideCover
          cover={{ color: style.color, material: style.material }}
          kicker={t("owner_kicker")}
          owner={owner}
        />
      </div>
    </div>
  );
  const page = (
    <div
      className="h-full"
      style={{ width: mobileSide ? "100%" : `${PAGE_PERCENT}%` }}
    >
      <NotebookContentsPage
        contents={contents}
        failed={failed}
        onOpenPage={onOpenPage}
        onStart={onStart}
        coil={mobileSide !== null}
      />
    </div>
  );

  if (mobileSide === "left") return inside;
  if (mobileSide === "right") return page;
  return (
    <>
      {inside}
      <NotebookSpine />
      {page}
    </>
  );
}
