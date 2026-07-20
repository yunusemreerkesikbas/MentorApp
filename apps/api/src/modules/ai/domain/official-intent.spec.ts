import { describe, expect, it } from "vitest";
import { classifyOfficialIntent } from "./official-intent";

describe("classifyOfficialIntent", () => {
  it.each([
    ["KPSS sinavi ne zaman?", "EXAM_DATE"],
    ["Sinava kac gun kaldi?", "EXAM_DATE"],
    ["Basvuru nasil yapiliyor?", "APPLICATION"],
    ["Application deadline nedir?", "APPLICATION"],
    ["Yerlestirme sonuclari nereden aciklanir?", "RESULT_PLACEMENT"],
    ["Sonuclar ne zaman aciklanacak?", "RESULT_PLACEMENT"],
    ["Sinav ucreti nedir?", "PROCESS"],
    ["Sinav sureci hangi adimlardan olusuyor?", "PROCESS"],
  ] as const)("classifies %s as %s", (message, expected) => {
    expect(classifyOfficialIntent(message)).toBe(expected);
  });

  it.each([
    "Deneme sonucumu yorumla",
    "Son denemede 72 net yaptim, analiz eder misin?",
    "Bugun cok kaygiliyim",
    "Matematikte nasil calismaliyim?",
  ])("does not route personal coaching text as official: %s", (message) => {
    expect(classifyOfficialIntent(message)).toBeNull();
  });

  it("normalizes Turkish casing and accents", () => {
    expect(classifyOfficialIntent("SINAV TARiHi NE ZAMAN ACIKLANACAK?")).toBe(
      "EXAM_DATE",
    );
  });
});
