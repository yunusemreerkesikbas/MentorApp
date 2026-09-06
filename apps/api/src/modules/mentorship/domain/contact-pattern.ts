/**
 * Tier-1 contact detection for text a coach writes and a student reads.
 *
 * Roadmap §9 lists disintermediation as the marketplace's main leak and answers it with "mask the
 * phone number / IBAN in chat". There is no chat yet, but a coach profile is the same hole one
 * slice early: free text, shown to exactly the people a coach would want to take off-platform.
 *
 * ponytail: this is Tier-1 — a word list and a few shapes, defeated by anyone who tries. It stops
 * an honest coach from typing their number out of habit, which is the common case; a determined
 * one needs the Tier-2 classifier roadmap §9 puts in a later phase. Do not grow this into one.
 *
 * REFUSAL, NOT MASKING. Starring out the digits would leave the coach believing they had written
 * something they had not, and the first they would hear of it is a student asking what the stars
 * mean. The API says no and says why.
 *
 * Turkish normalization matters more than the patterns: `İ`/`ı` break naive lowercasing, and
 * "İLETİŞİM" has to fold to the same string as "iletişim".
 */

/** Digits, and the separators people use to break a number up so it "does not look like one". */
const SEPARATORS = /[\s.\-_/()+]/g;

/** Checked on the text as written: stripping separators first would glue words into false hits. */
const AS_WRITTEN: { id: string; test: RegExp }[] = [
  // Email. Deliberately loose — a false positive here costs a rewrite, a miss costs the leak.
  { id: "email", test: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/ },
  // A handle. Requires the @ so "@" alone in prose is not enough; four characters keeps it from
  // firing on decorative use.
  { id: "handle", test: /@[a-z0-9._]{4,}/ },
  // Messaging apps named next to any digit — "wp 0532", "telegram: 555".
  { id: "messenger", test: /(whatsapp|wp|telegram|instagram|insta|signal|discord)\D{0,12}\d/ },
];

/**
 * Checked on the digits alone, after separators come out — both of these are ALWAYS written
 * broken up, so a pattern that only matched the unspaced form would catch nobody.
 */
const STRIPPED: { id: string; test: RegExp }[] = [
  // Turkish IBAN: TR + 24 digits.
  { id: "iban", test: /tr\d{24}/ },
  // Turkish mobiles are 10 digits after the leading 0 (5XXXXXXXXX), written with +90, with a
  // leading 0, or with neither. Anything shorter is a year, a score or a price.
  { id: "phone", test: /(^|\D)(90)?0?5\d{9}(\D|$)/ },
];

export interface ContactMatch {
  /** Which rule fired. The API turns it into a message; it is not shown raw. */
  id: string;
}

/**
 * Does this text look like it is handing out a way to reach someone off-platform?
 *
 * Returns the first rule that fired, or null. First rather than all: the caller refuses either
 * way, and listing every hit would only tell an author how to iterate around the check.
 */
export function findContactPattern(text: string): ContactMatch | null {
  const normalized = normalize(text);
  for (const { id, test } of AS_WRITTEN) {
    if (test.test(normalized)) return { id };
  }
  const stripped = normalized.replace(SEPARATORS, "");
  for (const { id, test } of STRIPPED) {
    if (test.test(stripped)) return { id };
  }
  return null;
}

/**
 * Lowercase the Turkish way, then fold the letters that carry a dot or a cedilla onto their ASCII
 * neighbours. `toLocaleLowerCase("tr-TR")` alone is not enough: it maps `İ`→`i̇` (i plus a combining
 * dot), which no ASCII pattern matches.
 */
function normalize(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    // Combining marks, so `i̇` collapses to `i` and `ş`/`ğ`/`ü`/`ö`/`ç` to their bases.
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i");
}
