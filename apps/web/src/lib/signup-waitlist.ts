export {
  isWaitlistEmail,
  isWaitlistOn,
  opensWaitlist,
} from "@mentor/core";

/** The invite email's link (`/kayit?davet=1`) lands on the signup form even while the waitlist is on. */
export function isInviteLink(search: URLSearchParams): boolean {
  return search.get("davet") === "1";
}
