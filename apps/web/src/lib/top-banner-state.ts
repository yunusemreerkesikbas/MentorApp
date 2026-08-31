export function advanceTopBannerIndex(currentIndex: number, itemCount: number): number {
  if (itemCount <= 0) return 0;
  if (itemCount === 1) return 0;
  return (currentIndex + 1) % itemCount;
}

const NOTHING_DISMISSED: ReadonlySet<string> = new Set<string>();

/**
 * Dismissed banner item ids, read back from sessionStorage.
 *
 * Storage is untrusted input: it survives across deploys, another tab can write it, and a user can
 * hand-edit it. Anything unparseable degrades to "nothing dismissed" — a banner reappearing is a
 * harmless outcome, a dashboard that throws on boot is not.
 */
export function parseDismissedIds(raw: string | null): ReadonlySet<string> {
  if (!raw) return NOTHING_DISMISSED;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return NOTHING_DISMISSED;
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return NOTHING_DISMISSED;
  }
}

/** Serialize for storage. Sorted so the value is stable and diffable across writes. */
export function serializeDismissedIds(ids: ReadonlySet<string>): string {
  return JSON.stringify([...ids].sort());
}
