import { describe, expect, it } from "vitest";
import en from "../../../i18n/locales/en/coaching.json";
import tr from "../../../i18n/locales/tr/coaching.json";

const KEYS = [
  "PHOTO_SIGNAL_EARLY",
  "PHOTO_SIGNAL_REPEATED",
  "LOWEST_AVERAGE_EARLY",
  "LOWEST_AVERAGE_REPEATED",
  "TASK_TITLE_PHOTO_SIGNAL",
  "TASK_TITLE_LOWEST_AVERAGE",
  "TREND_FIRST",
  "TREND_UP",
  "TREND_DOWN",
  "TREND_STEADY",
] as const;

function interpolate(template: string, subject: string): string {
  return template.replace("{subject}", subject);
}

describe("analysis focus locales", () => {
  it.each([
    ["tr", tr.focus],
    ["en", en.focus],
  ])("interpolates the subject without leaking braces in %s", (_locale, focus) => {
    for (const key of KEYS) {
      const message = interpolate(focus[key], "Türkçe");
      expect(message).toContain("Türkçe");
      expect(message).not.toContain("{subject}");
      expect(message).not.toContain("{Türkçe}");
    }
  });
});

