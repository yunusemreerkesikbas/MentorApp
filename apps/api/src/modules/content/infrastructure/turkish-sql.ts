import { sql } from "drizzle-orm";

/**
 * Diacritic-insensitive comparison for Turkish text, shared by every reference-data search.
 *
 * Turkish users routinely type ASCII ("bilgisayar muhendisligi", "saglik bakanligi"), which a plain
 * ILIKE never matches against "Bilgisayar Mühendisliği". `translate` runs before `lower` on purpose:
 * `lower('İ')` yields "i" plus a combining dot in Postgres, which would defeat the mapping.
 *
 * Extracted rather than copied per repository because the JS side folds the incoming query with the
 * same table — if the two ever disagreed, searches would silently return nothing.
 *
 * No index and no pg_trgm: a sequential scan over the ~21.5k programs measures ~2.5 ms, and every
 * other table here is far smaller. Revisit only if that stops being true.
 */
const TR_FROM = "çÇğĞıIİöÖşŞüÜâÂîÎûÛ";
const TR_TO = "ccggiiioossuuaaiiuu";

export const foldTurkish = (column: unknown) =>
  sql`lower(translate(${column}, ${TR_FROM}, ${TR_TO}))`;

/**
 * The JS half of the same fold, for the incoming query. Kept in this file next to the SQL half
 * precisely because they must not drift — a mismatch makes every search silently return nothing.
 * Ordinary `toLowerCase()` is wrong here: "İ" gains a combining dot in JS.
 */
const TR_MAP = new Map([...TR_FROM].map((ch, i) => [ch, TR_TO[i]!]));

export function foldTurkishText(value: string): string {
  return [...value]
    .map((ch) => TR_MAP.get(ch) ?? ch)
    .join("")
    .toLowerCase();
}
