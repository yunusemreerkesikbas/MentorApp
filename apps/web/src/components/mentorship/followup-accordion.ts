import type { MentorshipFollowupDto } from "@mentor/types";

/**
 * Which record the follow-up panel shows open; the rest are one-line rows. `choice` is what the
 * coach last did: `undefined` means nothing yet (the first open record on the page is what they
 * came for), `null` means they closed it, an id means they opened that record. A choice that is not
 * on this page falls back to the default.
 */
export function openFollowupId(
  items: readonly Pick<MentorshipFollowupDto, "id" | "status">[],
  choice: string | null | undefined,
): string | null {
  if (choice === null) return null;
  if (choice !== undefined && items.some((item) => item.id === choice)) return choice;
  return items.find((item) => item.status === "OPEN")?.id ?? null;
}
