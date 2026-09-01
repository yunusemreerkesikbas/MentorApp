import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["tr", "en"],
  defaultLocale: "tr",
  localePrefix: "as-needed",
  localeDetection: false,
  localeCookie: false,
  alternateLinks: false,
  pathnames: {
    "/": "/",
    "/login": { tr: "/giris", en: "/login" },
    "/signup": { tr: "/kayit", en: "/signup" },
    "/verify-email": { tr: "/eposta-dogrula", en: "/verify-email" },
    "/forgot-password": {
      tr: "/sifremi-unuttum",
      en: "/forgot-password",
    },
    "/reset-password": { tr: "/sifre-sifirla", en: "/reset-password" },
    "/onboarding": { tr: "/baslangic", en: "/onboarding" },
    "/cookie-preferences": {
      tr: "/cerez-tercihleri",
      en: "/cookie-preferences",
    },
    // One dynamic route for all legal documents; the slug itself is not localized (same choice as
    // `/knowledge/[slug]`). Slugs live in `@/lib/legal`.
    "/legal/[slug]": { tr: "/yasal/[slug]", en: "/legal/[slug]" },
    "/dashboard": { tr: "/panel", en: "/dashboard" },
    "/plan": "/plan",
    "/study-session": { tr: "/seans", en: "/study-session" },
    "/study-session/history": {
      tr: "/seans/gecmis",
      en: "/study-session/history",
    },
    /** Study room ("masa") — the shared ground a group co-works at. */
    "/study-session/rooms/[id]": {
      tr: "/seans/masa/[id]",
      en: "/study-session/rooms/[id]",
    },
    /**
     * Invite-link landing. Short on purpose (it gets pasted into chats) and outside the app
     * shell, so it can greet someone who has never signed in.
     */
    "/join-room": { tr: "/masaya-katil", en: "/join-room" },
    "/coach": { tr: "/koc", en: "/coach" },
    "/coach/chat": { tr: "/koc/sohbet", en: "/coach/chat" },
    "/analysis": { tr: "/analiz", en: "/analysis" },
    "/analysis/recap": {
      tr: "/analiz/haftanin-hikayesi",
      en: "/analysis/weekly-story",
    },
    "/knowledge": { tr: "/bilgi", en: "/knowledge" },
    "/knowledge/[slug]": {
      tr: "/bilgi/[slug]",
      en: "/knowledge/[slug]",
    },
    "/profile": { tr: "/profil", en: "/profile" },
    "/settings": { tr: "/ayarlar", en: "/settings" },
    "/subscription": { tr: "/abonelik", en: "/subscription" },
    "/subscription/result": {
      tr: "/abonelik/sonuc",
      en: "/subscription/result",
    },
    "/notebook": { tr: "/yanlis-defteri", en: "/notebook" },
    "/notebooks": { tr: "/defterlerim", en: "/notebooks" },
    "/notebooks/[notebookId]": {
      tr: "/defterlerim/[notebookId]",
      en: "/notebooks/[notebookId]",
    },
    "/vision-board": { tr: "/hedef", en: "/vision-board" },
    /** Collage editor. `/hedef` stays the data step (map + goal form); this is the optional canvas. */
    "/vision-board/board": { tr: "/hedef/pano", en: "/vision-board/board" },
    "/vision-board/simulation": {
      tr: "/hedef/simulasyon",
      en: "/vision-board/simulation",
    },
    "/community": { tr: "/topluluk", en: "/community" },
    "/community/feed": { tr: "/topluluk/akis", en: "/community/feed" },
    "/community/saved": {
      tr: "/topluluk/kayitli",
      en: "/community/saved",
    },
    "/community/leaderboard": {
      tr: "/topluluk/siralama",
      en: "/community/leaderboard",
    },
    "/community/trends": {
      tr: "/topluluk/gundem",
      en: "/community/trends",
    },
    "/community/member/[username]": {
      tr: "/topluluk/uye/[username]",
      en: "/community/member/[username]",
    },
    "/community/message/[threadId]": {
      tr: "/topluluk/mesaj/[threadId]",
      en: "/community/message/[threadId]",
    },
    "/community/question/[threadId]": {
      tr: "/topluluk/soru/[threadId]",
      en: "/community/question/[threadId]",
    },
    "/community/comment/[postId]": {
      tr: "/topluluk/yorum/[postId]",
      en: "/community/comment/[postId]",
    },
    "/community/[slug]": {
      tr: "/topluluk/[slug]",
      en: "/community/[slug]",
    },
    "/community/[slug]/management": {
      tr: "/topluluk/[slug]/yonetim",
      en: "/community/[slug]/management",
    },
    "/forum/question/[id]": {
      tr: "/forum/soru/[id]",
      en: "/forum/question/[id]",
    },
  },
});

export type Locale = (typeof routing.locales)[number];
