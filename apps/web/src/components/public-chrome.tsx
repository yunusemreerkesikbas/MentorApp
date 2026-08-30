"use client";

import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Minimal chrome for public, unauthenticated pages (SEO articles, legal documents) — logo + a way
 * back in, no app shell. `loginLabel` is passed in rather than translated here so the component
 * stays free of any single i18n namespace (it used to live under the knowledge route and read
 * `article.login`, which legal pages have no business depending on).
 */
export function PublicChrome({
  children,
  loginLabel,
  panelLabel,
}: {
  children: ReactNode;
  loginLabel: string;
  panelLabel: string;
}) {
  const { status } = useAuth();
  const authenticated = status === "authenticated";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-bg)" }}>
      <header
        className="border-b px-5 py-4 lg:px-8"
        style={{ borderColor: "color-mix(in srgb, var(--color-secondary) 20%, transparent)" }}
      >
        <div className="flex w-full items-center justify-between">
          <Link
            href="/"
            className="text-lg font-bold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            style={{ color: "var(--color-main)", fontFamily: "var(--font-heading)" }}
          >
            Mentor
          </Link>
          {status === "loading" ? (
            <span className="min-h-[44px] min-w-20" aria-hidden="true" />
          ) : (
            <Link
              href={authenticated ? "/dashboard" : "/login"}
              className="inline-flex min-h-[44px] items-center text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
              style={{ color: "var(--color-accent)", fontFamily: "var(--font-heading)" }}
            >
              {authenticated ? panelLabel : loginLabel}
            </Link>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
