"use client";

import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

/**
 * Minimal chrome for public, unauthenticated pages (SEO articles, legal documents) — logo + a way
 * back in, no app shell. `loginLabel` is passed in rather than translated here so the component
 * stays free of any single i18n namespace (it used to live under the knowledge route and read
 * `article.login`, which legal pages have no business depending on).
 */
export function PublicChrome({
  children,
  loginLabel,
}: {
  children: ReactNode;
  loginLabel: string;
}) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-bg)" }}>
      <header
        className="border-b px-5 py-4 lg:px-8"
        style={{ borderColor: "color-mix(in srgb, var(--color-secondary) 20%, transparent)" }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/"
            className="text-lg font-bold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            Mentor
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            style={{ color: "var(--color-accent)", fontFamily: "var(--font-heading)" }}
          >
            {loginLabel}
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
