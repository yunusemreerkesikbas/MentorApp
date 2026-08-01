/**
 * Turkish-aware text normalisation, shared by the ÖSYM import scripts.
 *
 * Extracted rather than copy-pasted because both scripts join on the result: the university
 * importer writes `slug`, the program importer looks universities up by it. If the two ever
 * normalised differently, every program would silently fail to find its university.
 */

const TR_MAP = {
  ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", I: "i", İ: "i",
  ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u",
  â: "a", Â: "a", î: "i", Î: "i", û: "u", Û: "u",
};

/**
 * Lowercase ASCII words, space-separated.
 *
 * The uppercase entries above are the point: `"İ".toLowerCase()` yields "i" + U+0307 in JS, and
 * the ASCII filter then deletes both — "İSTANBUL" would normalise to "stanbul".
 */
export function normalize(value) {
  return [...String(value ?? "")]
    .map((ch) => TR_MAP[ch] ?? ch)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function slugify(value) {
  return normalize(value).replace(/ /g, "-");
}
