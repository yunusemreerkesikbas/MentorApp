import type { WeeklyRecapArchiveItemDto, WeeklyRecapOfferDto } from "@mentor/types";

export function recapArchiveParams(item: Pick<WeeklyRecapArchiveItemDto, "id" | "examId" | "weekStart" | "requiresOpening">) {
  return item.requiresOpening
    ? { examId: item.examId, weekStart: item.weekStart, archive: "1" }
    : { reportId: item.id };
}

/** An archive lookup can recover an older right, but must never turn into a new purchase. */
export function recapArchiveOfferAllowed(offer: Pick<WeeklyRecapOfferDto, "enabled" | "mode" | "cost" | "reportId">): boolean {
  return Boolean(offer.reportId) || (offer.enabled && offer.mode === "OWNED" && offer.cost === 0);
}

export function recapPuhuNote(closingMessage: string, narration?: string): { text: string; personalized: boolean } {
  const text = narration?.trim();
  return text ? { text, personalized: true } : { text: closingMessage, personalized: false };
}

/** A native share sheet must settle before another one can open. */
export function createRecapShareLock() {
  let pending = false;
  return async (share: () => Promise<void>) => {
    if (pending) return;
    pending = true;
    try {
      await share();
    } finally {
      pending = false;
    }
  };
}

/** What the access card's main button does: the web's `onOpen`, as a step. */
export function recapOpenStep(
  offer: Pick<WeeklyRecapOfferDto, "mode" | "reportId">,
  armed: boolean,
): "read" | "confirm" | "open" | "none" {
  if (offer.reportId) return "read";
  if (offer.mode === "COIN" && !armed) return "confirm";
  // OWNED without a report is an older deep-analysis unlock: the server opens it for free.
  return offer.mode === "NONE" ? "none" : "open";
}

/**
 * Marks the week reviewed once. After the PUT it calls `onDone`, so the achievement it grants is
 * fetched while the story is still open (and plays on close); a failed PUT lets a later call retry.
 */
export function createRecapCompletion(complete: () => Promise<unknown>, onDone: () => void): () => void {
  let started = false;
  return () => {
    if (started) return;
    started = true;
    complete().then(onDone, () => {
      started = false;
    });
  };
}

/**
 * Story headlines keep a 411 dp phone's line breaks on narrower screens: at 36 dp a long Turkish
 * word ("durdurulamıyorsun!") is wider than a 360 dp phone's column and would break mid-word.
 * The column is the window less the slides' 32 dp side padding.
 */
export function headlineScale(windowWidth: number): number {
  return Math.min(1, (windowWidth - 64) / (411 - 64));
}

/**
 * ponytail: expo-video's Android `currentTime` getter blocks on the UI thread, so a clip checks its
 * drift once a second of story time, not on every 50 ms clock tick. Tighter sync = timeUpdate events.
 */
export function clipDriftCheckDue(elapsedMs: number, checkedAtMs: number | null): boolean {
  return checkedAtMs === null || Math.abs(elapsedMs - checkedAtMs) >= 1000;
}
