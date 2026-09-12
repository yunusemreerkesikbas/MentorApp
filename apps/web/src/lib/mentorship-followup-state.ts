import type { CreateMentorshipFollowupInput } from "@mentor/validation";

export interface PendingFollowupOperation {
  fingerprint: string;
  operationId: string;
}

type FollowupDraft = Omit<CreateMentorshipFollowupInput, "operationId">;

/**
 * Keep an idempotency key stable while the coach retries the same payload. Editing any field starts
 * a new logical operation, which also avoids the server's changed-payload conflict by construction.
 */
export function operationForDraft(
  current: PendingFollowupOperation | null,
  draft: FollowupDraft,
  createId: () => string,
): PendingFollowupOperation {
  const fingerprint = JSON.stringify([
    draft.title,
    draft.privateNote,
    draft.sharedDecision,
    draft.followUpDate,
    draft.replacesId,
  ]);
  return current?.fingerprint === fingerprint
    ? current
    : { fingerprint, operationId: createId() };
}

/** Calendar date in the product's scheduling zone, independent of the browser's local zone. */
export function istanbulDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function appendUniqueById<T extends { id: string }>(
  current: readonly T[],
  incoming: readonly T[],
): T[] {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !seen.has(item.id))];
}
