import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { signupLegalUrl } from "./signup-legal.ts";

describe("signup legal documents", () => {
  it("opens the canonical Turkish legal pages", () => {
    assert.equal(signupLegalUrl("kvkk", "tr"), "https://puhukoc.com/yasal/kvkk-aydinlatma");
    assert.equal(signupLegalUrl("terms", "tr"), "https://puhukoc.com/yasal/kullanim-kosullari");
  });

  it("opens the English translations from the same public registry", () => {
    assert.equal(signupLegalUrl("kvkk", "en"), "https://puhukoc.com/en/legal/kvkk-aydinlatma");
    assert.equal(signupLegalUrl("terms", "en"), "https://puhukoc.com/en/legal/kullanim-kosullari");
  });
});
