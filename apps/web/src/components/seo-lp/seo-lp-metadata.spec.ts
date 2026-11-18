import { describe, expect, it, vi } from "vitest";
import trMessages from "../../../messages/tr.json";

vi.mock("@/i18n/locale", () => ({ setRequestLocale: vi.fn() }));
vi.mock("@/lib/forum-public", () => ({
  siteUrl: () => "https://puhukoc.com",
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace?: string) => (key: string) => {
    const parts = (namespace ? `${namespace}.${key}` : key).split(".");
    let cur: unknown = trMessages;
    for (const part of parts) {
      cur = (cur as Record<string, unknown> | undefined)?.[part];
    }
    return typeof cur === "string" ? cur : key;
  },
}));

import { generateMetadata as generateMistakeNotebookMetadata } from "@/app/[locale]/mistake-notebook/page";
import { generateMetadata as generatePomodoroMetadata } from "@/app/[locale]/pomodoro-timer/page";
import { generateMetadata as generateStudyAppMetadata } from "@/app/[locale]/study-app/page";
import { generateStudyProgramMetadata } from "./study-program-lp-template";

describe("product-led SEO LP metadata", () => {
  it("generates indexable TR metadata and noindex EN metadata for /pomodoro-sayac", async () => {
    const tr = await generatePomodoroMetadata({ params: Promise.resolve({ locale: "tr" }) });
    const en = await generatePomodoroMetadata({ params: Promise.resolve({ locale: "en" }) });

    expect(tr.title).toBe("Pomodoro Sayaç Online | Ücretsiz Odak Sayacı · PuhuKoç");
    expect(tr.alternates?.canonical).toBe("https://puhukoc.com/pomodoro-sayac");
    expect(tr.robots).toEqual({ index: true, follow: true });
    expect(en.robots).toEqual({ index: false, follow: true });
    expect(en.alternates?.canonical).toBe("https://puhukoc.com/pomodoro-sayac");
  });

  it.each([
    ["yks", "https://puhukoc.com/yks-calisma-programi"],
    ["tyt", "https://puhukoc.com/tyt-calisma-programi"],
    ["lgs", "https://puhukoc.com/lgs-calisma-programi"],
  ] as const)("generates canonical TR metadata for %s study program LP", async (variant, expectedUrl) => {
    const tr = await generateStudyProgramMetadata(variant, "tr");
    const en = await generateStudyProgramMetadata(variant, "en");

    expect(tr.alternates?.canonical).toBe(expectedUrl);
    expect(tr.robots).toEqual({ index: true, follow: true });
    expect(en.robots).toEqual({ index: false, follow: true });
    expect(en.alternates?.canonical).toBe(expectedUrl);
  });

  it("generates canonical TR metadata for /yanlis-defteri-uygulamasi and /ders-calisma-uygulamasi", async () => {
    const nbTr = await generateMistakeNotebookMetadata({ params: Promise.resolve({ locale: "tr" }) });
    const nbEn = await generateMistakeNotebookMetadata({ params: Promise.resolve({ locale: "en" }) });
    expect(nbTr.alternates?.canonical).toBe("https://puhukoc.com/yanlis-defteri-uygulamasi");
    expect(nbTr.robots).toEqual({ index: true, follow: true });
    expect(nbEn.robots).toEqual({ index: false, follow: true });
    expect(nbEn.alternates?.canonical).toBe("https://puhukoc.com/yanlis-defteri-uygulamasi");

    const appTr = await generateStudyAppMetadata({ params: Promise.resolve({ locale: "tr" }) });
    const appEn = await generateStudyAppMetadata({ params: Promise.resolve({ locale: "en" }) });
    expect(appTr.alternates?.canonical).toBe("https://puhukoc.com/ders-calisma-uygulamasi");
    expect(appTr.robots).toEqual({ index: true, follow: true });
    expect(appEn.robots).toEqual({ index: false, follow: true });
    expect(appEn.alternates?.canonical).toBe("https://puhukoc.com/ders-calisma-uygulamasi");
  });
});
