import { describe, expect, it } from "vitest";
import tr from "../../../i18n/locales/tr/notifications.json";
import en from "../../../i18n/locales/en/notifications.json";
import { renderEmail, type EmailLang } from "./email-render";

const APP = "https://puhukoc.com";
const locales = { tr, en } as const;

/** Real copy with nestjs-i18n-style `{arg}` interpolation; `""` for a missing key. */
function makeT(lang: EmailLang, calls: string[] = []) {
  return (key: string, args: Record<string, unknown> = {}) => {
    calls.push(key);
    const value = key.split(".").reduce<unknown>(
      (node, part) => (node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined),
      locales[lang],
    );
    if (typeof value !== "string") return "";
    return value.replace(/\{(\w+)\}/g, (m, name: string) => (name in args ? String(args[name]) : m));
  };
}

function render(template: string, vars: Record<string, unknown> = {}, lang: EmailLang = "tr", calls?: string[]) {
  return renderEmail({ template, vars, lang, appUrl: APP, t: makeT(lang, calls) });
}

const buttons = (html: string) => html.match(/data-email-button/g) ?? [];

describe("renderEmail", () => {
  it("verify email has one button to the link and the fallback line", () => {
    const link = "https://puhukoc.com/eposta-dogrula?token=x";
    const { html, subject } = render("identity.verify-email", { displayName: "Selin", link });
    expect(subject).toBe("E-postanı doğrula");
    expect(html.split(`href="${link}"`)).toHaveLength(3);
    expect(buttons(html)).toHaveLength(1);
    expect(html).toContain("#55ACEE");
    expect(html).toContain("Merhaba Selin, hesabını");
    expect(html).toContain(`${APP}/img/email/logo.png`);
  });

  it("coach digest fills count, names and the list", () => {
    const { html, subject } = render("mentorship.risk-digest", {
      displayName: "Ayşe", count: 2, names: "Selin, Mert", studentNames: ["Selin", "Mert"],
    });
    expect(subject).toBe("Bugün bakmaya değer 2 öğrenci");
    expect(html).toContain("Selin, Mert son günlerde");
    expect(html.match(/data-email-student/g)).toHaveLength(2);
    expect(html).toContain("#26377F");
    expect(html).toContain(`href="${APP}/kocluk"`);
    expect(html).not.toMatch(/\{(count|names|hello|name|displayName)\}/);
  });

  it("followup due fills count", () => {
    expect(render("mentorship.followup-due", { count: 4, displayName: "Ayşe" }).subject).toBe("Bugün 4 takibin var");
  });

  it("dunning shows the date once", () => {
    const { html } = render("payments.dunning", { displayName: "Selin", graceUntil: "2026-11-12T10:00:00Z" });
    expect(html.split("12 Kasım 2026")).toHaveLength(2);
    expect(html).toContain(`href="${APP}/abonelik"`);
  });

  it("dunning without a date", () => {
    const { html } = render("payments.dunning", { graceUntil: "nope" });
    expect(html).not.toContain("Premium'un açık kalacağı son gün");
    expect(html).not.toContain("Invalid");
  });

  it("greets without a name", () => {
    const calls: string[] = [];
    const { html } = render("coaching.daily-reminder", { displayName: "" }, "tr", calls);
    expect(calls).toContain("email.common.hello");
    expect(calls).not.toContain("email.common.helloName");
    expect(html).toContain("Merhaba, kendine");
  });

  it("escapes student names", () => {
    const { html, text } = render("mentorship.risk-digest", {
      displayName: "Ayşe", count: 1, names: "<script>x</script>", studentNames: ["<script>x</script>"],
    });
    expect(html).not.toContain("<script>x");
    expect(html).toContain("&lt;script&gt;x");
    expect(text).toContain("<script>x</script>");
  });

  it.each([
    ["payments.dunning", "/en/subscription"],
    ["payments.subscription-welcome", "/en/dashboard"],
    ["coaching.daily-reminder", "/en/dashboard"],
    ["mentorship.risk-digest", "/en/coaching/students"],
    ["mentorship.followup-due", "/en/coaching/students"],
  ])("english links: %s", (template, path) => {
    const { html } = render(template, { count: 1, names: "A", studentNames: ["A"] }, "en");
    expect(html).toContain(`href="${APP}${path}"`);
    expect(html).toContain('lang="en"');
  });

  it("notification footer links to preferences", () => {
    expect(render("coaching.daily-reminder").html).toContain(`${APP}/profil#notification-settings`);
    expect(render("mentorship.followup-due", { count: 1 }).html).toContain(`${APP}/profil#notification-settings`);
    expect(render("identity.verify-email", { link: "https://puhukoc.com/x" }).html).not.toContain("notification-settings");
  });

  it("welcome has the header art, badge and three benefits", () => {
    const { html } = render("payments.subscription-welcome", { displayName: "Selin" });
    expect(html).toContain(`${APP}/img/email/puhu-welcome.png`);
    expect(html).toContain("PREMIUM");
    expect(html.match(/data-email-benefit/g)).toHaveLength(3);
    expect(html).toContain(`${APP}/abonelik`);
  });

  it("drops an unsafe link instead of rendering it", () => {
    const { html, text } = render("identity.reset-password", { link: "javascript:alert(1)" });
    expect(html).not.toContain("javascript:");
    expect(text).not.toContain("javascript:");
    expect(buttons(html)).toHaveLength(0);
  });

  it("unknown template", () => {
    const { html, subject } = render("x.y");
    expect(subject).toBe("PuhuKoç");
    expect(buttons(html)).toHaveLength(0);
  });

  it("text version", () => {
    const { text } = render("payments.subscription-welcome", { displayName: "Selin" });
    expect(text).toContain("Premium'a hoş geldin!");
    expect(text).toContain("Merhaba Selin, koçun");
    expect(text).toContain(`${APP}/panel`);
    expect(text).not.toContain("<");
  });
});
