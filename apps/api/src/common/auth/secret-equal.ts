import { timingSafeEqual } from "node:crypto";

/** Secret values must never be compared with ordinary string equality. */
export function secretEqual(provided: string | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
