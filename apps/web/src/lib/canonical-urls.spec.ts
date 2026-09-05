import { describe, expect, it } from "vitest";
import { infoArticleUrl } from "./content-api";
import { questionUrl } from "./forum-public";

/**
 * The canonical URLs that go into sitemaps, metadata and share links.
 *
 * These assertions used to live in `apps/api/src/localized-routing.spec.ts`, which imported web
 * source from the API package. That file never actually ran: `next-intl` reaches for
 * `next/navigation`, which does not resolve from the API's dependency tree, so vitest failed to
 * collect the suite and the coverage was imaginary. `apps/web`'s own config inlines next-intl and
 * has Next as a dependency, so here they run.
 *
 * Always TR and always prefix-free: Turkish is the default locale, and a canonical URL that
 * carried `/tr` would compete with the prefix-free one for the same page.
 */
describe("canonical public URLs", () => {
  it("builds a knowledge article URL on the Turkish path", () => {
    expect(infoArticleUrl("kpss-basvuru")).toBe(
      "http://localhost:3000/bilgi/kpss-basvuru",
    );
  });

  it("builds a forum question URL on the Turkish path", () => {
    expect(questionUrl("question-id")).toBe(
      "http://localhost:3000/forum/soru/question-id",
    );
  });
});
