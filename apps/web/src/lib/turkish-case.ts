const BACK_VOWELS = "aıouâû";
const FRONT_VOWELS = "eiöüî";

/**
 * Names that end in a palatal l take the front suffix whatever their last vowel says ("Kemal'e").
 * ponytail: a short list, not a lexicon; a name missing here gets the regular back suffix.
 */
const PALATAL_L = new Set(["kemal", "cemal", "celal", "hilal", "bilal", "meral", "nihal", "iclal", "ikbal"]);

/**
 * What the suffix harmonises with: the name's last vowel (lower-cased the Turkish way, so "İ" is
 * a front vowel and "I" a back one), whether that vowel is front, and whether the name ends on it.
 */
function lastVowel(name: string) {
  const lower = name.toLocaleLowerCase("tr");
  const vowels = [...lower].filter((char) => BACK_VOWELS.includes(char) || FRONT_VOWELS.includes(char));
  const last = vowels.at(-1);
  return {
    last,
    front: PALATAL_L.has(lower) || last === undefined || FRONT_VOWELS.includes(last),
    endsInVowel: last !== undefined && lower.endsWith(last),
  };
}

/**
 * A proper name in the dative, apostrophe included: "Zeynep'e", "Ali'ye", "Burak'a".
 * Vowel harmony on the last vowel, a buffer y after a final vowel.
 */
export function dativeOf(name: string): string {
  const { front, endsInVowel } = lastVowel(name);
  return `${name}'${endsInVowel ? "y" : ""}${front ? "e" : "a"}`;
}

/**
 * A proper name in the genitive, apostrophe included: "Burak'ın", "Mert'in", "Umut'un", "Gül'ün",
 * "Ali'nin". Four-way harmony on the last vowel (rounded vowels keep their roundness), a buffer n
 * after a final vowel.
 */
export function genitiveOf(name: string): string {
  const { last, front, endsInVowel } = lastVowel(name);
  const rounded = last !== undefined && "ouöüû".includes(last) && !PALATAL_L.has(name.toLocaleLowerCase("tr"));
  const vowel = front ? (rounded ? "ü" : "i") : rounded ? "u" : "ı";
  return `${name}'${endsInVowel ? "n" : ""}${vowel}n`;
}
