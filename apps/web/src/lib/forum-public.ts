import type { PublicDiscoveryQuestion, PublicQuestionView } from "@mentor/types";
import { cache } from "react";

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

export function communityDiscoveryUrl(): string {
  return `${siteUrl()}${getPathname({ locale: "tr", href: "/discover-community" })}`;
}

/** Public QA snapshot. Read fresh so moderation changes are honored on the next visit. */
export async function fetchPublicQuestion(id: string): Promise<PublicQuestionView | null> {
  const res = await fetch(
    `${publicApiBase()}/v1/forum/public/questions/${encodeURIComponent(id)}`,
    { cache: "no-store" },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Public question fetch failed: ${res.status}`);
  return (await res.json()) as PublicQuestionView;
}

/** Fresh selected questions shared by the directory and sitemap. */
export const fetchDiscoveryQuestions = cache(async (): Promise<PublicDiscoveryQuestion[]> => {
  const res = await fetch(`${publicApiBase()}/v1/forum/public/discovery`, {
    cache: "no-store", signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`Public question discovery failed: ${res.status}`);
  return (await res.json()) as PublicDiscoveryQuestion[];
});
