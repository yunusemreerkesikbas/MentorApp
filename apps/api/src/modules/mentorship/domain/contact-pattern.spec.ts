import { describe, expect, it } from "vitest";
import { findContactPattern } from "./contact-pattern";

const hit = (text: string) => findContactPattern(text)?.id ?? null;

describe("findContactPattern", () => {
  it("passes an ordinary coach bio", () => {
    expect(
      hit("On yıldır KPSS adaylarıyla çalışıyorum. Paragraf ve dil bilgisi ağırlıklı ilerliyoruz."),
    ).toBeNull();
  });

  describe("phone numbers", () => {
    it("catches a plain mobile number", () => {
      expect(hit("Bana 05321234567 numarasından ulaş")).toBe("phone");
    });

    it("catches it spaced out", () => {
      expect(hit("0532 123 45 67")).toBe("phone");
    });

    it("catches it with the country code", () => {
      expect(hit("+90 532 123 45 67")).toBe("phone");
    });

    it("catches it dotted, which is the obvious way to hide one", () => {
      expect(hit("532.123.45.67")).toBe("phone");
    });

    // False positives cost a coach a rewrite for no reason, so the shorter runs stay silent.
    it("leaves years, scores and prices alone", () => {
      expect(hit("2019 mezunuyum, 40 yıllık deneyim, 1500 soru çözdürdüm")).toBeNull();
    });

    it("does not fire on a long number that is not a phone shape", () => {
      expect(hit("Öğrenci numaram 1234567890123")).toBeNull();
    });
  });

  describe("other channels", () => {
    it("catches an email address", () => {
      expect(hit("koc@ornek.com üzerinden yaz")).toBe("email");
    });

    it("catches a Turkish IBAN even when it is spaced, which is how one is always written", () => {
      expect(hit("TR33 0006 1005 1978 6457 8413 26")).toBe("iban");
    });

    it("catches a social handle", () => {
      expect(hit("Instagramdan @kocumemre yaz")).toBe("handle");
    });

    it("catches an app named next to a number", () => {
      expect(hit("wp: 532")).toBe("messenger");
    });
  });

  describe("Turkish normalization", () => {
    // The reason this file does not just call toLowerCase(): `İ` lowercases to `i` + a combining
    // dot, which no ASCII pattern matches.
    it("folds the dotted capital I", () => {
      expect(hit("İLETİŞİM: KOC@ORNEK.COM")).toBe("email");
    });

    it("folds the dotless ı so a handle is still a handle", () => {
      expect(hit("@kocumemre")).toBe("handle");
    });

    it("still passes ordinary Turkish prose with those letters in it", () => {
      expect(hit("Öğrencilerimle sınav gününe kadar şevkle çalışırım.")).toBeNull();
    });
  });
});
