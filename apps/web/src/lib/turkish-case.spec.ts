import { describe, expect, it } from "vitest";
import { dativeOf } from "./turkish-case";

describe("dativeOf", () => {
  it("follows the last vowel: back vowels take -a, front vowels take -e", () => {
    expect(["Zeynep", "Mert", "Burak", "Umut", "Ömer", "Nur"].map(dativeOf)).toEqual([
      "Zeynep'e",
      "Mert'e",
      "Burak'a",
      "Umut'a",
      "Ömer'e",
      "Nur'a",
    ]);
  });

  it("adds the buffer y after a final vowel", () => {
    expect(["Ali", "Ece", "Sena", "Ayşe", "Duru"].map(dativeOf)).toEqual([
      "Ali'ye",
      "Ece'ye",
      "Sena'ya",
      "Ayşe'ye",
      "Duru'ya",
    ]);
  });

  it("reads dotted and dotless i by Turkish rules, capitals included", () => {
    expect(["İlkay", "Irmak", "Işıl", "İpek"].map(dativeOf)).toEqual([
      "İlkay'a",
      "Irmak'a",
      "Işıl'a",
      "İpek'e",
    ]);
  });

  it("keeps the front -e of names that end in a palatal l", () => {
    expect(["Kemal", "Hilal", "Meral"].map(dativeOf)).toEqual(["Kemal'e", "Hilal'e", "Meral'e"]);
  });
});
