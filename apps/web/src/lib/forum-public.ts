import type { PublicQuestionRef, PublicQuestionView } from "@mentor/types";

/** Strips a trailing /v1 — API paths include the prefix. Mirrors content-api.ts. */
export function publicApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  return raw.replace(/\/v1\/?$/, "");
}

/** Public site origin (canonical URLs, sitemap, robots). No trailing slash. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Canonical (TR) URL for a public QA question. */
export function questionUrl(id: string): string {
  return `${siteUrl()}/tr/forum/soru/${id}`;
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
