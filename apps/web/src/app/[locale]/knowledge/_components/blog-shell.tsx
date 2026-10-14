"use client";

import dynamic from "next/dynamic";
import { Suspense, useLayoutEffect, type ReactNode } from "react";
import { useLocale, type AbstractIntlMessages } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { hasCompletedOnboarding } from "@/lib/post-auth-destination";
import { BLOG_ACTION, BLOG_MEMBER_HINT_KEY } from "./blog-ui";

// Members only: AppNav, its providers and framer-motion stay out of a visitor's bundle.
const BlogMemberChrome = dynamic(
  () => import("./blog-member-chrome").then((module) => module.BlogMemberChrome),
  { ssr: false },
);

const catalogs = new Map<string, Promise<AbstractIntlMessages>>();

/**
 * The app chrome reads the whole catalogue, as `(app)` does. Fetched once, by members only: the
 * article's server payload stays inside its message budget.
 */
function loadCatalog(locale: string): Promise<AbstractIntlMessages> {
  let catalog = catalogs.get(locale);
  if (!catalog) {
    catalog = (
      locale === "en"
        ? import("../../../../../messages/en.json")
        : import("../../../../../messages/tr.json")
    ).then((module) => module.default as AbstractIntlMessages);
    catalogs.set(locale, catalog);
  }
  return catalog;
}

/**
 * Blog chrome (2026-10-14). A visitor gets one thin bar: the wordmark and "Giriş yap". A member gets
 * the app's own navigation instead, so the blog reads as part of the app.
 *
 * Which one shows is `html[data-blog-member]` (globals.css): the bootstrap script guesses it from the
 * last visit before paint, this component settles it once the session answers.
 */
export function BlogShell({
  children,
  loginLabel,
  panelLabel,
}: {
  children: ReactNode;
  loginLabel: string;
  panelLabel: string;
}) {
  const { status, user } = useAuth();
  const locale = useLocale();
  const member = status === "authenticated" && user !== null && hasCompletedOnboarding(user);

  // Before paint, and on client navigation too, where the inline bootstrap never runs.
  useLayoutEffect(() => {
    if (status === "loading") return;
    const root = document.documentElement;
    if (member) root.dataset.blogMember = "";
    else delete root.dataset.blogMember;
    try {
      if (member) localStorage.setItem(BLOG_MEMBER_HINT_KEY, "1");
      else localStorage.removeItem(BLOG_MEMBER_HINT_KEY);
    } catch {
      // Storage blocked: a member's reload paints the visitor bar first, nothing worse.
    }
  }, [status, member]);

  return (
    // Opaque on purpose: the blog reads on plain `--color-bg`, not over the layout's blobs.
    <div className="blog-shell min-h-screen bg-[var(--color-bg)]">
      <header className="blog-shell-bar border-b border-[var(--play-line)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8 lg:h-18 lg:px-10">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-lg font-black tracking-[-0.01em] text-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] sm:text-xl"
          >
            PuhuKoç
          </Link>
          {status === "loading" ? (
            <span className="min-h-11 min-w-20" aria-hidden="true" />
          ) : (
            // Signed in but not onboarded: no app chrome yet, so the way back in stays here.
            <Link href={status === "authenticated" ? "/dashboard" : "/login"} className={BLOG_ACTION}>
              {status === "authenticated" ? panelLabel : loginLabel}
            </Link>
          )}
        </div>
      </header>
      {/* Beside `children`, never around them: the page keeps its place in the tree either way. */}
      {member ? (
        <Suspense fallback={null}>
          <BlogMemberChrome catalog={loadCatalog(locale)} />
        </Suspense>
      ) : null}
      {children}
    </div>
  );
}
