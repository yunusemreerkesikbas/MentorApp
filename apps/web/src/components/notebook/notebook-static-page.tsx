"use client";

import { memo } from "react";
import type { NotebookEntryDto, NotebookPageDoc } from "@mentor/types";
import { NotebookPageSurface } from "./notebook-surface";
import { NotebookPageStage } from "./notebook-page-stage";
import { NotebookInkLayer } from "./notebook-ink-layer";

/**
 * A page as a picture: paper, what is placed on it, and the ink over it, with no way to touch any
 * of it. What a turning leaf carries on its two faces and what lies still underneath while it turns.
 *
 * Inert by construction: the stage is handed no pointer callbacks, which is what makes it
 * non-interactive (`NotebookPageStage` derives that from the props it receives).
 */
export const NotebookStaticPage = memo(function NotebookStaticPage({
  doc,
  entries,
  dueIds,
  binding = "left",
  coil = false,
}: {
  doc: NotebookPageDoc;
  entries: NotebookEntryDto[];
  dueIds?: ReadonlySet<string>;
  binding?: "left" | "right";
  coil?: boolean;
}) {
  return (
    <NotebookPageSurface paper={doc.paper} binding={binding} coil={coil}>
      <NotebookPageStage items={doc.items} entries={entries} dueIds={dueIds} />
      <NotebookInkLayer strokes={doc.ink} />
    </NotebookPageSurface>
  );
});
