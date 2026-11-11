import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enMessages, formatMessage, trMessages } from "./index.ts";

describe("mobile TR/EN i18n catalog & voice constitution rules", () => {
  it("maintains 1:1 namespace and key parity between TR and EN", () => {
    const trNamespaces = Object.keys(trMessages).sort();
    const enNamespaces = Object.keys(enMessages).sort();
    assert.deepEqual(trNamespaces, enNamespaces);

    for (const ns of trNamespaces) {
      const trKeys = Object.keys(trMessages[ns as keyof typeof trMessages]).sort();
      const enKeys = Object.keys(enMessages[ns as keyof typeof enMessages]).sort();
      assert.deepEqual(trKeys, enKeys, `Mismatch in namespace ${ns}`);
    }
  });

  it("enforces voice.md bans: no em-dash, no 'lütfen', no 'AI' in Turkish strings", () => {
    for (const [ns, entries] of Object.entries(trMessages)) {
      for (const [key, value] of Object.entries(entries)) {
        assert.equal(value.includes("—"), false, `Em-dash found in tr.${ns}.${key}`);
        assert.equal(/lütfen/i.test(value), false, `'lütfen' found in tr.${ns}.${key}`);
        assert.equal(/\bAI\b/.test(value), false, `'AI' found in tr.${ns}.${key}; use 'yapay zekâ'`);
      }
    }
    for (const [ns, entries] of Object.entries(enMessages)) {
      for (const [key, value] of Object.entries(entries)) {
        assert.equal(value.includes("—"), false, `Em-dash found in en.${ns}.${key}`);
        assert.equal(/\bplease\b/i.test(value), false, `'please' found in en.${ns}.${key}`);
      }
    }
  });

  it("interpolates template parameters cleanly", () => {
    assert.equal(
      formatMessage(trMessages.dashboard.greeting_morning, { name: "Selin" }),
      "Günaydın, Selin!",
    );
  });
});
