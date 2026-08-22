/**
 * What the mistake notebook hands the community composer, beyond the entry id in the URL.
 *
 * The handoff has always carried `?notebookEntry=<id>` and nothing else, which is enough to link the
 * thread to the card *afterwards* but leaves the student staring at an empty form with no sign of
 * why they are there. The composer cannot fetch the card either: there is no endpoint for one entry,
 * only a paged list.
 *
 * So the notebook, which is holding the entry already, leaves what it knows in `sessionStorage` on
 * the way out. One key, written on the click and taken on arrival.
 *
 * ponytail: `sessionStorage`, not the URL and not a new endpoint. The URL would put the student's
 * own labels in the address bar (and their note is theirs, not a query string's); an endpoint would
 * be a round trip for three strings the previous screen was already holding.
 */

const KEY = "mentor.notebook-handoff";

export interface NotebookHandoff {
  /** Guards against a stale payload seeding an unrelated question. */
  entryId: string;
  /** "Ders · Konu", already composed — the composer has no subject data of its own. */
  label: string;
  /** Already translated: the notebook owns that namespace, the community composer does not. */
  errorTypeLabel: string;
  /**
   * The card's photo, when it has one — a storage key to copy from and a URL to preview it with.
   *
   * Both, because they answer different questions: the key is what the server copies (the browser
   * never touches the bytes), the URL is what the banner shows so the student can see what they are
   * about to publish before they publish it.
   */
  photo?: { storageKey: string; url: string };
}

export function putNotebookHandoff(handoff: NotebookHandoff): void {
  // Private browsing modes throw on write. Losing the prefill is a worse form of the same screen
  // the student gets today, not a failure worth interrupting the handoff for.
  try {
    sessionStorage.setItem(KEY, JSON.stringify(handoff));
  } catch {
    /* no prefill, same as before */
  }
}

/**
 * Reads the handoff for `entryId`, or null when there is none or it belongs to another card.
 *
 * Deliberately non-destructive, which is what lets the composer call it while rendering: a read
 * that also deletes is a side effect, and a side effect during render is one React is free to run
 * twice — the second run would come back empty and blank the banner. Clearing is its own call,
 * made when the handoff is actually spent.
 */
export function readNotebookHandoff(entryId: string): NotebookHandoff | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NotebookHandoff>;
    if (parsed.entryId !== entryId) return null;
    if (!parsed.label || !parsed.errorTypeLabel) return null;
    return parsed as NotebookHandoff;
  } catch {
    return null;
  }
}

/** Spent — a second question in the same visit is just a question, not one about this card. */
export function clearNotebookHandoff(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
