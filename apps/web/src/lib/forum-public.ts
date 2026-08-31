import type { PublicQuestionRef, PublicQuestionView } from "@mentor/types";

import { getPathname } from "../i18n/navigation";

import { apiBaseUrl } from "./api-base";

export const publicApiBase = apiBaseUrl;

/** Public site origin (canonical URLs, sitemap, robots). No trailing slash. */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_SITE_URL is required in production");
    }
    return "http://localhost:3000";
  }

  const url = new URL(configured);
  if (process.env.NODE_ENV === "production") {
    if (url.protocol !== "https:") {
      throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS in production");
    }
    if (
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    ) {
      throw new Error("NEXT_PUBLIC_SITE_URL must be a bare origin in production");
    }
  }
  return url.origin;
}

/** Canonical (TR) URL for a public QA question. */
export function questionUrl(id: string): string {
  return `${siteUrl()}${getPathname({
    locale: "tr",
    href: {
      pathname: "/forum/question/[id]",
      params: { id },
    },
  })}`;
}

/** Public (anon) indexable QA question, or null (404 / not indexable). ISR-cached. */
export async function fetchPublicQuestion(id: string): Promise<PublicQuestionView | null> {
  const res = await fetch(
    `${publicApiBase()}/v1/forum/public/questions/${encodeURIComponent(id)}`,
    { next: { revalidate: 3600 } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Public question fetch failed: ${res.status}`);
  return (await res.json()) as PublicQuestionView;
}

/** Indexable QA question refs for the sitemap. */
export async function fetchPublicQuestionRefs(): Promise<PublicQuestionRef[]> {
  const res = await fetch(`${publicApiBase()}/v1/forum/public/questions`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Public question refs fetch failed: ${res.status}`);
  return (await res.json()) as PublicQuestionRef[];
}
