import { describe, expect, it } from "vitest";

import { evaluateText, renderEvalReport } from "./prompt-eval";

describe("prompt eval hard checks", () => {
  it("reports objective text contract violations", () => {
    const checks = evaluateText("**Harika!** 🎉 12.06.2026 tarihinde 500 TL.", {
      maxSentences: 2,
      plainText: true,
      requiredPatterns: [/\/bilgi/i],
      forbiddenPatterns: [/\b\d+\s*(?:TL|₺|lira)\b/iu],
    });

    expect(checks).toEqual([
      { name: "non-empty", severity: "hard", passed: true, detail: "output contains text" },
      { name: "plain-text", severity: "hard", passed: false, detail: "markdown or emoji found" },
      { name: "max-sentences", severity: "review", passed: true, detail: "2/2 sentences" },
      { name: "required-pattern-1", severity: "hard", passed: false, detail: "required pattern not found: /\\/bilgi/i" },
      { name: "forbidden-pattern-1", severity: "hard", passed: false, detail: "forbidden pattern found: /\\b\\d+\\s*(?:TL|₺|lira)\\b/iu" },
    ]);
  });

  it("counts memory lines as items", () => {
    const checks = evaluateText("Hedef: KPSS\nZorluk: Paragraf\nTercih: Sabah\nRitim: 25 dk\nEk: yok", {
      maxItems: 4,
      plainText: true,
    });

    expect(checks.find((check) => check.name === "max-items")).toEqual({
      name: "max-items",
      severity: "hard",
      passed: false,
      detail: "5/4 items",
    });
  });

  it("renders a human-reviewable Markdown report", () => {
    const report = renderEvalReport([
      {
        id: "official-info-refusal",
        model: "gpt-4o-mini",
        rawOutput: "Doğrulanmış bilgi için /bilgi sayfasına bak.",
        promptTokens: 100,
        completionTokens: 20,
        estimatedCostMicros: 27,
        latencyMs: 345,
        checks: [{ name: "non-empty", severity: "hard", passed: true, detail: "output contains text" }],
      },
    ]);

    expect(report).toContain("# AI Prompt Eval Report");
    expect(report).toContain("Hard-check failures: 0 · Review warnings: 0");
    expect(report).toContain("official-info-refusal");
    expect(report).toContain("gpt-4o-mini");
    expect(report).toContain("27 micro-USD");
    expect(report).toContain("345 ms");
    expect(report).toContain("Doğrulanmış bilgi için /bilgi sayfasına bak.");
    expect(report).toContain("Sıcak ve yargılamayan ton");
  });
});