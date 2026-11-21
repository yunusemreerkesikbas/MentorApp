import { describe, expect, it } from "vitest";
import enMessages from "../../../messages/en.json";
import trMessages from "../../../messages/tr.json";

const NEW_KEYS = [
  "pomodoroLp.subhead",
  "pomodoroLp.scribble",
  "pomodoroLp.hero_note.name",
  "pomodoroLp.hero_note.body",
  "studyProgramLp.yks.subhead",
  "studyProgramLp.tyt.subhead",
  "studyProgramLp.lgs.subhead",
  "studyProgramLp.common.scribble",
  "mistakeNotebookLp.subhead",
  "mistakeNotebookLp.scribble",
  "mistakeNotebookLp.scene_aria",
  "mistakeNotebookLp.ecosystem.who_name",
  "studyAppLp.subhead",
  "studyAppLp.scribble",
  "studyAppLp.definition_pill",
  "studyAppLp.scene.aria",
  "studyAppLp.scene.plate",
  "studyAppLp.scene.tag_plan",
  "studyAppLp.scene.tag_odak",
  "studyAppLp.scene.tag_defter",
  "studyAppLp.scene.tag_masa",
  "studyAppLp.scene.tag_puhu",
  "studyAppLp.features.f1_name",
  "studyAppLp.features.f2_name",
  "studyAppLp.features.f3_name",
  "studyAppLp.features.f4_name",
  "studyAppLp.features.f5_name",
];

function resolve(messages: unknown, path: string): unknown {
  let cur = messages;
  for (const part of path.split(".")) {
    cur = (cur as Record<string, unknown> | undefined)?.[part];
  }
  return cur;
}

describe("SEO LP copy contract", () => {
  it("keeps the SEO H1s verbatim", () => {
    expect(trMessages.pomodoroLp.h1).toBe("Ücretsiz online pomodoro sayaç");
    expect(trMessages.mistakeNotebookLp.h1).toBe(
      "Yanlış defteri: sorularını kaydet, tekrar zamanı dön",
    );
    expect(trMessages.studyAppLp.h1).toBe(
      "Ders çalışma uygulaması: planın ve çalışma masan bir arada",
    );
    expect(trMessages.studyProgramLp.yks.h1).toBe(
      "YKS çalışma programı: hedefine göre haftanı kur",
    );
  });

  it("has every new key in TR and EN", () => {
    for (const key of NEW_KEYS) {
      for (const messages of [trMessages, enMessages]) {
        const value = resolve(messages, key);
        expect(typeof value, key).toBe("string");
        expect((value as string).trim().length, key).toBeGreaterThan(0);
      }
    }
  });

  it("uses the ICU plate pattern in both locales", () => {
    expect(trMessages.studyAppLp.scene.plate).toBe("NO {n}");
    expect(enMessages.studyAppLp.scene.plate).toBe("NO {n}");
  });

  it("never writes AI in TR vitrin copy", () => {
    for (const key of NEW_KEYS) {
      expect(resolve(trMessages, key) as string, key).not.toMatch(/\bAI\b/);
    }
  });
});
