export type GreetingKey = "greeting_morning" | "greeting_day" | "greeting_evening";

/** Part of the local day; each surface keeps the copy in its own namespace. */
export function greetingKeyForHour(hour = new Date().getHours()): GreetingKey {
  if (hour < 12) return "greeting_morning";
  if (hour < 18) return "greeting_day";
  return "greeting_evening";
}

/** "Selin Kaya" → "Selin": a greeting uses the first name, like a person would. */
export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || displayName;
}

const BACK_VOWELS = "aıouâû";
const FRONT_VOWELS = "eiöüî";

/**
 * Names that end in a palatal l take the front suffix whatever their last vowel says ("Kemal'e").
 */
const PALATAL_L = new Set([
  "kemal",
  "cemal",
  "celal",
  "hilal",
  "bilal",
  "meral",
  "nihal",
  "iclal",
  "ikbal",
]);

function lastVowel(name: string) {
  const lower = name.toLocaleLowerCase("tr");
  const vowels = [...lower].filter(
    (char) => BACK_VOWELS.includes(char) || FRONT_VOWELS.includes(char),
  );
  const last = vowels.at(-1);
  return {
    last,
    front: PALATAL_L.has(lower) || last === undefined || FRONT_VOWELS.includes(last),
    endsInVowel: last !== undefined && lower.endsWith(last),
  };
}

/**
 * A proper name in the dative, apostrophe included: "Zeynep'e", "Ali'ye", "Burak'a".
 */
export function dativeOf(name: string): string {
  const { front, endsInVowel } = lastVowel(name);
  return `${name}'${endsInVowel ? "y" : ""}${front ? "e" : "a"}`;
}

/**
 * A proper name in the genitive, apostrophe included: "Burak'ın", "Mert'in", "Umut'un", "Gül'ün", "Ali'nin".
 */
export function genitiveOf(name: string): string {
  const { last, front, endsInVowel } = lastVowel(name);
  const rounded =
    last !== undefined && "ouöüû".includes(last) && !PALATAL_L.has(name.toLocaleLowerCase("tr"));
  const vowel = front ? (rounded ? "ü" : "i") : rounded ? "u" : "ı";
  return `${name}'${endsInVowel ? "n" : ""}${vowel}n`;
}

/** Locale-safe uppercase helper for Turkish (`i` → `İ`, `ı` → `I`). */
export function toLocaleUpper(text: string, locale: "tr" | "en" = "tr"): string {
  return text.toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US");
}
