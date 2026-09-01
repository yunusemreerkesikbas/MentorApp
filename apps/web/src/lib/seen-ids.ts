/**
 * Small id-set persistence for "show this once" surfaces — the dashboard banner's per-item
 * dismissal and the promotion dialog's per-campaign display.
 *
 * Both read Web Storage, which is untrusted input: it survives deploys, another tab can write it,
 * a user can hand-edit it, and in a private window or with site data blocked the accessor itself
 * throws. Every failure mode degrades to "nothing seen" — a surface reappearing is harmless, a
 * dashboard that throws on boot is not.
 */

const NOTHING: ReadonlySet<string> = new Set<string>();

export function parseIdSet(raw: string | null): ReadonlySet<string> {
  if (!raw) return NOTHING;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return NOTHING;
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return NOTHING;
  }
}

/** Sorted so the stored value is stable across writes and diffable when debugging. */
export function serializeIdSet(ids: ReadonlySet<string>): string {
  return JSON.stringify([...ids].sort());
}

type StorageArea = "local" | "session";

function area(kind: StorageArea): Storage {
  return kind === "local" ? localStorage : sessionStorage;
}

export function readIdSet(kind: StorageArea, key: string): ReadonlySet<string> {
  try {
    return parseIdSet(area(kind).getItem(key));
  } catch {
    return NOTHING;
  }
}

/** Best-effort: when storage is unavailable the caller's in-memory state still holds for the visit. */
export function writeIdSet(kind: StorageArea, key: string, ids: ReadonlySet<string>): void {
  try {
    area(kind).setItem(key, serializeIdSet(ids));
  } catch {
    // Ignore — the surface simply may reappear on the next visit.
  }
}
