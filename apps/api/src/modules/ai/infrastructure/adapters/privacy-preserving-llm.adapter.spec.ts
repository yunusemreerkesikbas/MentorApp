import { describe, expect, it, vi } from "vitest";
import type { LlmCompleteInput, LlmPort, LlmStreamEvent } from "../../domain/llm.port";
import {
  minimizeUserPrompt,
  PrivacyPreservingLlmAdapter,
} from "./privacy-preserving-llm.adapter";

describe("AI provider privacy boundary", () => {
  it("redacts common direct identifiers from Turkish free text", () => {
    const input = [
      "Adım Emre Erkesikbaş.",
      "E-posta emre@example.com, telefonum +90 532 123 45 67.",
      "TC 10000000146 ve IBAN TR33 0006 1005 1978 6457 8413 26.",
      "Kart 4111 1111 1111 1111, IP 192.168.1.22.",
      "@arkadas ve https://example.com/reset?token=secret",
    ].join(" ");

    const minimized = minimizeUserPrompt(input);

    expect(minimized).not.toContain("Emre Erkesikbaş");
    expect(minimized).not.toContain("emre@example.com");
    expect(minimized).not.toContain("532 123 45 67");
    expect(minimized).not.toContain("10000000146");
    expect(minimized).not.toContain("TR33");
    expect(minimized).not.toContain("4111 1111");
    expect(minimized).not.toContain("192.168.1.22");
    expect(minimized).not.toContain("token=secret");
    expect(minimized).toContain("[ad]");
    expect(minimized).toContain("[e-posta]");
    expect(minimized).toContain("[telefon]");
    expect(minimized).toContain("[kimlik]");
    expect(minimized).toContain("[IBAN]");
    expect(minimized).toContain("[kart]");
    expect(minimized).toContain("[IP]");
    expect(minimized).toContain("[kullanıcı]");
    expect(minimized).toContain("[bağlantı]");
  });

  it("sanitizes the live turn and history without changing grounded system content", async () => {
    const complete = vi.fn(async (_input: LlmCompleteInput) => ({
      text: "yanıt",
      promptTokens: 1,
      completionTokens: 1,
      model: "stub",
    }));
    const delegate: LlmPort = {
      complete,
      async *completeStream(): AsyncIterable<LlmStreamEvent> {
        yield { final: { text: "yanıt", promptTokens: 1, completionTokens: 1, model: "stub" } };
      },
      embed: vi.fn(async () => []),
    };
    const adapter = new PrivacyPreservingLlmAdapter(delegate, {
      acquire: vi.fn(async () => "budget-id"),
      release: vi.fn(async () => undefined),
    } as never);
    const original = {
      system: "Verified source: https://osym.gov.tr/article",
      user: "Bana emre@example.com üzerinden yaz",
      history: [{ role: "user" as const, content: "Telefonum 0532 123 45 67" }],
    };

    await adapter.complete(original);

    expect(complete).toHaveBeenCalledWith({
      system: original.system,
      user: "Bana [e-posta] üzerinden yaz",
      history: [{ role: "user", content: "Telefonum [telefon]" }],
    });
    expect(original.user).toContain("emre@example.com");
  });

  it("passes editorial embedding content through unchanged", async () => {
    const embed = vi.fn(async () => [1]);
    const delegate = {
      complete: vi.fn(),
      completeStream: vi.fn(),
      embed,
    } as unknown as LlmPort;
    const adapter = new PrivacyPreservingLlmAdapter(delegate, {
      acquire: vi.fn(async () => null),
      release: vi.fn(async () => undefined),
    } as never);

    await adapter.embed("Source: https://osym.gov.tr/contact@example.com");

    expect(embed).toHaveBeenCalledWith("Source: https://osym.gov.tr/contact@example.com");
  });

  it("releases the budget hold when the provider fails", async () => {
    const release = vi.fn(async () => undefined);
    const adapter = new PrivacyPreservingLlmAdapter(
      {
        complete: vi.fn(async () => { throw new Error("provider down"); }),
        completeStream: vi.fn(),
        embed: vi.fn(),
      } as unknown as LlmPort,
      { acquire: vi.fn(async () => "budget-id"), release } as never,
    );

    await expect(adapter.complete({ system: "system", user: "user" })).rejects.toThrow(
      "provider down",
    );
    expect(release).toHaveBeenCalledWith("budget-id");
  });
});
