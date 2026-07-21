import { describe, expect, it } from "vitest";
import { getPathname } from "../../web/src/i18n/navigation";
import { infoArticleUrl } from "../../web/src/lib/content-api";
import { questionUrl } from "../../web/src/lib/forum-public";

describe("localized web routing", () => {
  it("maps canonical routes to Turkish and English public paths", () => {
    expect(getPathname({ locale: "tr", href: "/dashboard" })).toBe("/panel");
    expect(getPathname({ locale: "en", href: "/dashboard" })).toBe(
      "/en/dashboard",
    );
    expect(getPathname({ locale: "tr", href: "/coach/chat" })).toBe(
      "/koc/sohbet",
    );
    expect(getPathname({ locale: "en", href: "/coach/chat" })).toBe(
      "/en/coach/chat",
    );
  });

  it("builds prefixes-free Turkish canonical URLs", () => {
    expect(infoArticleUrl("kpss-basvuru")).toBe(
      "http://localhost:3000/bilgi/kpss-basvuru",
    );
    expect(questionUrl("question-id")).toBe(
      "http://localhost:3000/forum/soru/question-id",
    );
  });
});
