"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ThreadView } from "@mentor/types";
import { useMentorToast } from "@/lib/mentor-toast";
import { linkNotebookThread } from "@/lib/notebook";
import { clearNotebookHandoff, readNotebookHandoff } from "@/lib/notebook-handoff";
import { clearSpentQueryParam } from "@/lib/spent-query-param";

/**
 * The query parameter the mistake notebook hands over on, carrying the entry whose question the
 * student is about to ask. See `NotebookReviewPanel`'s stuck screen.
 */
const NOTEBOOK_ENTRY_PARAM = "notebookEntry";

/**
 * Handoff from the mistake notebook: a card the student missed twice, whose question they are being
 * offered the community for. The notebook cannot create the thread itself (which zone a question
 * belongs in depends on what the user has joined), so it sends them here with the entry id, and the
 * link back to the card is made once the thread exists.
 */
export function useNotebookHandoff() {
  const t = useTranslations("community");
  const toast = useMentorToast();
  const searchParams = useSearchParams();
  /**
   * Spent once, and derived rather than mirrored into state by an effect: with the handoff open the
   * dialog is open, and consuming it is what closes it. A second question in the same visit is just
   * a question: it must not link itself to the same card.
   */
  const [spent, setSpent] = useState(false);
  const entryId = spent ? null : searchParams.get(NOTEBOOK_ENTRY_PARAM);
  /** What the notebook left behind for *this* card; an older payload belongs to an asked question. */
  const handoff = entryId ? readNotebookHandoff(entryId) : null;

  /** Marks the handoff used up here, and takes the parameter out of the address bar with it. */
  const spend = useCallback(() => {
    setSpent(true);
    clearNotebookHandoff();
    clearSpentQueryParam(NOTEBOOK_ENTRY_PARAM);
  }, []);

  /** Links a new question back to the card. Never blocks the question: it is already public. */
  const linkCreated = useCallback(
    async (thread: ThreadView) => {
      if (!entryId) return;
      try {
        await linkNotebookThread(entryId, thread.id);
        toast.success({ title: t("notebook_linked") });
      } catch {
        toast.error({ title: t("notebook_link_failed") });
      }
      spend();
    },
    [entryId, spend, t, toast],
  );

  return { entryId, handoff, spend, linkCreated };
}
