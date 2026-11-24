import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { signupLegalUrl } from "./signup-legal.ts";

describe("signup legal documents", () => {
  it("opens the chat privacy notice in the app language", () => {
    assert.equal(signupLegalUrl("privacy", "tr"), "https://puhukoc.com/yasal/gizlilik-politikasi");
    assert.equal(signupLegalUrl("privacy", "en"), "https://puhukoc.com/en/legal/gizlilik-politikasi");
  });
  it("opens the canonical Turkish legal pages", () => {
    assert.equal(signupLegalUrl("kvkk", "tr"), "https://puhukoc.com/yasal/kvkk-aydinlatma");
    assert.equal(signupLegalUrl("terms", "tr"), "https://puhukoc.com/yasal/kullanim-kosullari");
  });

  it("opens the English translations from the same public registry", () => {
    assert.equal(signupLegalUrl("kvkk", "en"), "https://puhukoc.com/en/legal/kvkk-aydinlatma");
    assert.equal(signupLegalUrl("terms", "en"), "https://puhukoc.com/en/legal/kullanim-kosullari");
  });
});
