import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  // Pin the origin instead of inheriting whatever the runner exports.
  //
  // These assertions used to spell out `http://localhost:3000`, which is the fallback `siteUrl()`
  // returns when NEXT_PUBLIC_SITE_URL is unset — so they passed on a laptop and failed in CI, where
  // the workflow exports `https://mentor.example`. Same trap `docs/standards/backend.md` records
  // for STORAGE_PROVIDER: a suite whose result depends on the ambient environment gets ignored on
  // every machine. Stubbing (like `site-url.spec.ts` next door) keeps this file's subject the PATH
  // shape, which is what it is actually about.
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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
