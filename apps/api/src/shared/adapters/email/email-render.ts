import { EMAIL_COPY_KEY } from "../../notifications/constants";
import { assertSafeHttpUrl, escapeHtml } from "./email-html.util";

/**
 * Builds every transactional email (DESIGN: e-posta canvas, 2026-11-01): one 600px card on the
 * blob-blue wash, one button, a footer. Table layout with inline styles so Gmail and Outlook keep it;
 * art is hosted PNG under the web app's `public/img/email/` (no SVG, no CSS gradients).
 * Copy lives in `notifications.email.*`; `t` returns "" for a missing key.
 */
export type EmailLang = "tr" | "en";
type T = (key: string, args?: Record<string, unknown>) => string;

export interface RenderEmailInput {
  template: string;
  vars: Record<string, unknown>;
  lang: EmailLang;
  appUrl: string;
  t: T;
}

type Kind = "plain" | "welcome" | "reminder" | "coach";
type Footer = "transaction" | "subscription" | "notification" | "coach";
type Path = "link" | "dashboard" | "subscription" | "students";

const DEFS: Record<string, { kind: Kind; footer: Footer; path: Path }> = {
  "identity.verify-email": { kind: "plain", footer: "transaction", path: "link" },
  "identity.reset-password": { kind: "plain", footer: "transaction", path: "link" },
  "identity.signup-invitation": { kind: "reminder", footer: "transaction", path: "link" },
  "payments.dunning": { kind: "plain", footer: "transaction", path: "subscription" },
  "payments.subscription-welcome": { kind: "welcome", footer: "subscription", path: "dashboard" },
  "coaching.daily-reminder": { kind: "reminder", footer: "notification", path: "dashboard" },
  "mentorship.risk-digest": { kind: "coach", footer: "coach", path: "students" },
  "mentorship.followup-due": { kind: "coach", footer: "coach", path: "students" },
};

const PATHS: Record<Exclude<Path, "link"> | "preferences", Record<EmailLang, string>> = {
  dashboard: { tr: "/panel", en: "/en/dashboard" },
  subscription: { tr: "/abonelik", en: "/en/subscription" },
  students: { tr: "/kocluk", en: "/en/coaching/students" },
  preferences: { tr: "/profil#notification-settings", en: "/en/profile#notification-settings" },
};

const SUPPORT = "destek@puhukoc.com";
const FONT = "'Nunito', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
const C = { ink: "#111111", body: "#333333", muted: "#666666", link: "#1A5FA3", coach: "#26377F", line: "#E7E7E7" };
const LINK_SENTINEL = "\u0001";

export function renderEmail({ template, vars, lang, appUrl, t }: RenderEmailInput) {
  const def = DEFS[template];
  const kind = def?.kind ?? "plain";
  const key = EMAIL_COPY_KEY[template] ?? "fallback";
  const name = String(vars.displayName ?? "").trim();
  const args = {
    count: vars.count ?? "",
    names: vars.names ?? "",
    hello: name ? t("email.common.helloName", { name }) : t("email.common.hello"),
  };
  const copy = (field: string) => t(`email.${key}.${field}`, args);
  const url = (path: string) => new URL(path, appUrl).href;
  const accent = kind === "coach" ? C.coach : C.link;
  const ctaHref = !def ? "" : def.path === "link" ? assertSafeHttpUrl(String(vars.link ?? "")) : url(PATHS[def.path][lang]);
  const cta = ctaHref ? copy("cta") : "";
  const date = template === "payments.dunning" ? formatDate(vars.graceUntil, lang) : "";
  const students = kind === "coach" && Array.isArray(vars.studentNames) ? vars.studentNames.map(String) : [];
  const benefits = kind === "welcome" ? [1, 2, 3].map((i) => copy(`benefit${i}`)) : [];

  const subject = copy("subject");
  const heading = copy("heading");
  const body = copy("body");
  const note = copy("note");
  const validity = template === "identity.reset-password" ? copy("validity") : "";

  // Card body, top to bottom; each block is a padded row of the card table.
  const blocks: string[] = [];
  const logo = img(`${appUrl}/img/email/logo.png`, "PuhuKoç", 122, 39);
  if (kind === "welcome") {
    blocks.push(row(logo, "32px 44px 0"));
    blocks.push(row(img(`${appUrl}/img/email/puhu-welcome.png`, "", 600, 260, "width:100%;height:auto;"), "16px 0 0"));
  } else if (kind === "reminder") {
    blocks.push(row(`${logo}${reminderBand(`${appUrl}/img/email/puhu-encouraging.png`, copy("bubble"))}`, "32px 44px 28px", "background:#EAF5FD;"));
  } else if (kind === "coach") {
    blocks.push(row(`<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="vertical-align:middle;">${logo}</td><td style="vertical-align:middle;padding-left:12px;"><span style="${chip(C.coach, "#E6E9F7", 13, 800)}">${escapeHtml(t("email.common.coachChip"))}</span></td></tr></table>`, "40px 44px 0"));
  } else {
    blocks.push(row(logo, "40px 44px 0"));
  }

  const top = kind === "welcome" || kind === "reminder" ? "28px" : "24px";
  if (kind === "welcome") blocks.push(row(`<span style="${chip("#12141A", "#C4B8E0", 11, 900)}letter-spacing:0.06em;background-image:linear-gradient(135deg,#7EB6E8 0%,#C4B8E0 52%,#F3A6C8 100%);">${escapeHtml(copy("badge"))}</span>`, `${top} 44px 0`));
  if (heading) blocks.push(row(`<h1 style="margin:0;font-family:${FONT};font-size:26px;line-height:1.25;font-weight:800;letter-spacing:-0.01em;color:${C.ink};">${escapeHtml(heading)}</h1>`, `${kind === "welcome" ? "12px" : top} 44px 0`));
  blocks.push(row(para(body, 16, C.body, 1.6), `${heading ? "12px" : top} 44px 0`));
  if (date) blocks.push(row(infoBox(copy("dateLabel"), date), "24px 44px 0"));
  if (students.length) blocks.push(row(studentList(students), "24px 44px 0"));
  if (benefits.length) blocks.push(row(benefitList(copy("benefitsTitle"), benefits), "24px 44px 0"));
  if (cta) blocks.push(row(button(cta, ctaHref, kind === "coach"), "24px 44px 0"));
  if (cta && validity) blocks.push(row(para(validity, 13, C.muted, 1.45), "12px 44px 0"));
  if (cta && def?.path === "link") blocks.push(row(`${para(t("email.common.fallbackLink"), 13, C.muted, 1.45)}<a href="${escapeHtml(ctaHref)}" style="font-family:${FONT};font-size:13px;color:${C.link};word-break:break-all;">${escapeHtml(ctaHref)}</a>`, "20px 44px 0"));
  if (note) blocks.push(row(`<div style="border-top:1px solid ${C.line};padding-top:20px;">${para(note, 13, C.muted, 1.45)}</div>`, "24px 44px 0"));

  const footer = footerHtml(def?.footer ?? "transaction", t, url, lang, accent);
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(subject)}</title><link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&amp;display=swap" rel="stylesheet"><style>${MOBILE_CSS}</style></head><body style="margin:0;padding:0;background:#F3F8FD;">`
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(copy("preheader"))}</div>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F8FD;"><tr><td align="center" style="padding:32px 12px 40px;">`
    + `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">`
    + `<tr><td style="background:#FFFFFF;border-radius:20px;overflow:hidden;padding-bottom:40px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${blocks.join("")}</table></td></tr>`
    + `<tr><td align="center" style="padding:28px 16px 0;">${footer.html}</td></tr>`
    + `</table></td></tr></table></body></html>`;

  const text = [
    heading || copy("bubble"),
    body,
    date ? `${copy("dateLabel")}: ${date}` : "",
    students.join(", "),
    benefits.map((b) => `- ${b}`).join("\n"),
    cta ? `${cta}: ${ctaHref}` : "",
    validity && cta ? validity : "",
    note,
    footer.text,
  ].filter(Boolean).join("\n\n");

  return { subject, html, text };
}

function formatDate(raw: unknown, lang: EmailLang): string {
  const date = new Date(String(raw ?? ""));
  if (raw == null || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "tr-TR", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul",
  }).format(date);
}

/** Phones: narrower side padding and a stacked info box (clients without <style> keep the desktop layout). */
const MOBILE_CSS = "@media (max-width:480px){.em-px{padding-left:24px!important;padding-right:24px!important}"
  + ".em-stack{display:block!important;width:auto!important;text-align:left!important}.em-val{padding-top:0!important}}";

function row(inner: string, padding: string, extra = ""): string {
  return `<tr><td class="em-px" style="padding:${padding};${extra}">${inner}</td></tr>`;
}

function para(text: string, size: number, color: string, lh: number): string {
  return `<p style="margin:0;font-family:${FONT};font-size:${size}px;line-height:${lh};color:${color};">${escapeHtml(text)}</p>`;
}

function img(src: string, alt: string, w: number, h: number, extra = ""): string {
  return `<img src="${escapeHtml(src)}" width="${w}" height="${h}" alt="${escapeHtml(alt)}" style="display:block;border:0;outline:none;${extra}">`;
}

function chip(color: string, bg: string, size: number, weight: number): string {
  return `display:inline-block;font-family:${FONT};font-size:${size}px;font-weight:${weight};line-height:1.2;color:${color};background-color:${bg};border-radius:999px;padding:4px 12px;`;
}

function button(label: string, href: string, coach: boolean): string {
  const [bg, ink, edge] = coach ? ["#26377F", "#FFFFFF", "#1F2C66"] : ["#55ACEE", "#0F2233", "#3B8FD0"];
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:16px;background-color:${bg};">`
    + `<a data-email-button href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;line-height:1.2;font-weight:800;color:${ink};text-decoration:none;border-radius:16px;border-bottom:4px solid ${edge};">${escapeHtml(label)}</a>`
    + `</td></tr></table>`;
}

function infoBox(label: string, value: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E4EEFE;border-radius:14px;"><tr>`
    + `<td class="em-stack" style="padding:16px 20px;font-family:${FONT};font-size:14px;color:${C.body};">${escapeHtml(label)}</td>`
    + `<td class="em-stack em-val" align="right" style="padding:16px 20px;font-family:${FONT};font-size:16px;font-weight:800;color:${C.ink};white-space:nowrap;">${escapeHtml(value)}</td></tr></table>`;
}

function studentList(names: string[]): string {
  const rows = names.map((n, i) => `<tr><td data-email-student style="padding:12px 18px;${i ? `border-top:1px solid ${C.line};` : ""}">`
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>`
    + `<td width="36" height="36" align="center" style="width:36px;height:36px;border-radius:18px;background-color:#E6E9F7;font-family:${FONT};font-size:15px;font-weight:800;color:${C.coach};">${escapeHtml(n.trim().charAt(0).toLocaleUpperCase("tr-TR"))}</td>`
    + `<td style="padding-left:14px;font-family:${FONT};font-size:16px;font-weight:700;color:${C.ink};">${escapeHtml(n)}</td></tr></table></td></tr>`);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.line};border-radius:14px;">${rows.join("")}</table>`;
}

function benefitList(title: string, items: string[]): string {
  const rows = items.map((b) => `<tr><td data-email-benefit style="padding-top:12px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>`
    + `<td width="32" height="32" align="center" style="width:32px;height:32px;border-radius:10px;background-color:#E4EEFE;font-family:${FONT};font-size:16px;font-weight:900;color:${C.link};">&#10003;</td>`
    + `<td style="padding-left:12px;font-family:${FONT};font-size:15px;line-height:1.45;color:${C.body};">${escapeHtml(b)}</td></tr></table></td></tr>`);
  return `<p style="margin:0;font-family:${FONT};font-size:16px;font-weight:800;color:${C.ink};">${escapeHtml(title)}</p><table role="presentation" cellpadding="0" cellspacing="0" border="0">${rows.join("")}</table>`;
}

function reminderBand(src: string, bubble: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;"><tr>`
    + `<td style="vertical-align:middle;">${img(src, "Puhu", 112, 119)}</td>`
    + `<td style="vertical-align:middle;padding-left:16px;"><div style="background-color:#FFFFFF;border-radius:18px 18px 18px 6px;padding:16px 20px;font-family:${FONT};font-size:17px;line-height:1.4;font-weight:800;color:${C.ink};">${escapeHtml(bubble)}</div></td>`
    + `</tr></table>`;
}

/** Fills `{link}` in a footer sentence with an anchor; the rest of the sentence stays escaped text. */
function withLink(t: T, key: string, label: string, href: string, color: string) {
  const [before = "", after = ""] = t(key, { link: LINK_SENTINEL }).split(LINK_SENTINEL);
  return {
    html: `${escapeHtml(before)}<a href="${escapeHtml(href)}" style="color:${color};">${escapeHtml(label)}</a>${escapeHtml(after)}`,
    text: href.startsWith("mailto:") ? `${before}${label}${after}` : `${before}${label}${after} (${href})`,
  };
}

function footerHtml(footer: Footer, t: T, url: (p: string) => string, lang: EmailLang, color: string) {
  const first = footer === "transaction"
    ? { html: escapeHtml(t("email.common.footerTransaction")), text: t("email.common.footerTransaction") }
    : footer === "subscription"
      ? withLink(t, "email.common.footerSubscription", t("email.common.subscriptionLink"), url(PATHS.subscription[lang]), color)
      : withLink(t, footer === "coach" ? "email.common.footerCoach" : "email.common.footerNotification", t("email.common.preferences"), url(PATHS.preferences[lang]), color);
  const help = withLink(t, "email.common.help", SUPPORT, `mailto:${SUPPORT}`, color);
  return {
    html: `<p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};">${first.html}<br>${help.html}</p>`,
    text: `${first.text}\n${help.text}`,
  };
}
