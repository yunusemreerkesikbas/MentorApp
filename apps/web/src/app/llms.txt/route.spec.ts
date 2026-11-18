import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/forum-public", () => ({
  siteUrl: () => "https://puhukoc.com",
}));

import { GET } from "./route";

describe("GET /llms.txt", () => {
  it("returns a plain-text AI context document listing canonical routes and exam families", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");

    const text = await response.text();
    expect(text).toContain("# PuhuKoç");
    expect(text).toContain("KPSS, YKS, LGS, ALES ve DGS");
    expect(text).toContain("https://puhukoc.com/pomodoro-sayac");
    expect(text).toContain("https://puhukoc.com/yks-calisma-programi");
    expect(text).toContain("https://puhukoc.com/tyt-calisma-programi");
    expect(text).toContain("https://puhukoc.com/lgs-calisma-programi");
    expect(text).toContain("https://puhukoc.com/yanlis-defteri-uygulamasi");
    expect(text).toContain("https://puhukoc.com/ders-calisma-uygulamasi");
    expect(text).toContain("https://puhukoc.com/koclar");
  });
});
