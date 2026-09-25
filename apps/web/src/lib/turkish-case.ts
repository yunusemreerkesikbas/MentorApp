const BACK_VOWELS = "aıouâû";
const FRONT_VOWELS = "eiöüî";

/**
 * Names that end in a palatal l take the front suffix whatever their last vowel says ("Kemal'e").
 * ponytail: a short list, not a lexicon; a name missing here gets the regular back suffix.
 */
const PALATAL_L = new Set(["kemal", "cemal", "celal", "hilal", "bilal", "meral", "nihal", "iclal", "ikbal"]);

/**
 * A proper name in the dative, apostrophe included: "Zeynep'e", "Ali'ye", "Burak'a".
 *
 * Vowel harmony on the last vowel, a buffer y after a final vowel. Lower-cased the Turkish way
 * first, so "İ" is a front vowel and "I" a back one.
 */
export function dativeOf(name: string): string {
  const lower = name.toLocaleLowerCase("tr");
  const vowels = [...lower].filter((char) => BACK_VOWELS.includes(char) || FRONT_VOWELS.includes(char));
  const last = vowels.at(-1);
  const front = PALATAL_L.has(lower) || last === undefined || FRONT_VOWELS.includes(last);
  const endsInVowel = vowels.length > 0 && lower.endsWith(last!);
  return `${name}'${endsInVowel ? "y" : ""}${front ? "e" : "a"}`;
}
