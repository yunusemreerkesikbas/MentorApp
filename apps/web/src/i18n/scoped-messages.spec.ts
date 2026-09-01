import { describe, expect, it } from "vitest";
import enMessages from "../../messages/en.json";
import trMessages from "../../messages/tr.json";
import { pickMessages, ROUTE_MESSAGE_SCOPES } from "./scoped-messages";

describe("pickMessages", () => {
  const messages = {
    analyticsConsent: { title: "Çerez tercihi" },
    article: { login: "Giriş yap" },
    knowledge: { title: "Bilgi merkezi" },
  };

  it("serializes only the namespaces requested by a route", () => {
    expect(pickMessages(messages, ["article", "knowledge"])).toEqual({
      article: { login: "Giriş yap" },
      knowledge: { title: "Bilgi merkezi" },
    });
  });

  it("fails loudly when a route requests a missing namespace", () => {
    expect(() => pickMessages(messages, ["welcome"])).toThrow(/welcome/);
  });

  it("keeps scoped route namespaces mirrored in TR and EN", () => {
    for (const namespaces of Object.values(ROUTE_MESSAGE_SCOPES)) {
      const tr = pickMessages(trMessages, namespaces);
      const en = pickMessages(enMessages, namespaces);
      expect(Object.keys(en)).toEqual(Object.keys(tr));
      for (const namespace of namespaces) {
        expect(Object.keys(en[namespace] ?? {}).sort()).toEqual(
          Object.keys(tr[namespace] ?? {}).sort(),
        );
      }
    }
  });

  it("keeps welcome and article client message payloads inside their budgets", () => {
    for (const messagesByLocale of [trMessages, enMessages]) {
      const root = pickMessages(messagesByLocale, ROUTE_MESSAGE_SCOPES.root);
      const welcome = pickMessages(messagesByLocale, ROUTE_MESSAGE_SCOPES.welcome);
      const article = pickMessages(messagesByLocale, ROUTE_MESSAGE_SCOPES.article);

      expect(Buffer.byteLength(JSON.stringify(root))).toBeLessThanOrEqual(1_024);
      expect(Buffer.byteLength(JSON.stringify(welcome))).toBeLessThanOrEqual(2_048);
      expect(Buffer.byteLength(JSON.stringify(article))).toBeLessThanOrEqual(6_144);
    }
  });
});
