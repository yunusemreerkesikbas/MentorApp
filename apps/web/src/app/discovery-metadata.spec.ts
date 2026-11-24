import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateMetadata } from "./[locale]/discover-community/page";
import { generateMetadata as questionMetadata } from "./[locale]/forum/question/[id]/page";
import { fetchDiscoveryQuestions, fetchPublicQuestion } from "@/lib/forum-public";

vi.mock("@/i18n/locale", () => ({ setRequestLocale: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("@mentor/ui", () => ({ Logo: () => null }));
vi.mock("@/components/public-footer", () => ({ PublicFooter: () => null }));
vi.mock("@/components/ads/deferred-contextual-ad-slot", () => ({ DeferredContextualAdSlot: () => null }));
vi.mock("@/lib/forum-public", () => ({
  siteUrl: () => "https://puhukoc.test",
  communityDiscoveryUrl: () => "https://puhukoc.test/topluluk",
  questionUrl: (id: string) => `https://puhukoc.test/forum/soru/${id}`,
  fetchDiscoveryQuestions: vi.fn(),
  fetchPublicQuestion: vi.fn(),
}));

describe("anonymous discovery metadata", () => {
  beforeEach(() => vi.resetAllMocks());

  it("keeps the preview and unavailable directory out of the index", async () => {
    const props = { params: Promise.resolve({ locale: "tr" }) };
    vi.mocked(fetchDiscoveryQuestions).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("Unavailable"));
    expect((await generateMetadata(props)).robots).toEqual({ index: false, follow: true });
    expect((await generateMetadata(props)).robots).toEqual({ index: false, follow: true });
  });

  it("indexes the populated Turkish directory and canonicalizes its English copy", async () => {
    vi.mocked(fetchDiscoveryQuestions).mockResolvedValue([{ id: "selected", title: "Study plan", examType: "LGS", updatedAt: "2026-11-12" }]);
    const tr = await generateMetadata({ params: Promise.resolve({ locale: "tr" }) });
    const en = await generateMetadata({ params: Promise.resolve({ locale: "en" }) });
    expect(tr.robots).toEqual({ index: true, follow: true });
    expect(en.robots).toEqual({ index: false, follow: true });
    expect(en.alternates?.canonical).toBe(tr.alternates?.canonical);
  });

  it("applies noindex to an eligible question outside the selection", async () => {
    const question = { id: "q", title: "Study plan", body: "A question", createdAt: "2026-11-12", answers: [] };
    vi.mocked(fetchPublicQuestion).mockResolvedValueOnce(question).mockResolvedValueOnce({ ...question, discoverable: true });
    const props = { params: Promise.resolve({ locale: "tr", id: "q" }) };
    expect((await questionMetadata(props)).robots).toEqual({ index: false, follow: true });
    expect((await questionMetadata(props)).robots).toEqual({ index: true, follow: true });
  });
});
