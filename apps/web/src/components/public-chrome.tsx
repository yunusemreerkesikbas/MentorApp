"use client";

import type { ReactNode } from "react";
import { PANEL_TEXT_LINK } from "@/components/panel/panel-styles";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { blogHref } from "@/lib/blog-href";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";

/**
 * Chrome for public pages (blog, legal documents): wordmark, the Blog link and a way back in, no app
 * shell. Labels arrive as props so the component stays free of any single i18n namespace (it used to
 * read `article.login`, which legal pages have no business depending on).
 */
export function PublicChrome({
  children,
  loginLabel,
  panelLabel,
  blogLabel,
}: {
  children: ReactNode;
  loginLabel: string;
  panelLabel: string;
  blogLabel: string;
}) {
  const { status, user } = useAuth();
  const pathname = usePathname();
  const onBlog = pathname === "/knowledge" || pathname.startsWith("/knowledge/");

  return (
    // No background here: `body` paints `--color-bg`, and an opaque wrapper would hide the layout's
    // `-z-10` BackgroundBlobs (DESIGN §2.2, the public canvas's atmosphere).
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8 lg:h-18 lg:px-10">
          <nav className="flex items-center gap-5 sm:gap-8">
            <Link
              href="/"
              className={`inline-flex min-h-11 items-center text-lg font-black tracking-[-0.01em] text-[var(--color-main)] sm:text-xl ${FOCUS}`}
            >
              Mentor
            </Link>
            <Link
              href={blogHref({ family: user?.examType ?? undefined })}
              aria-current={onBlog ? "page" : undefined}
              className={`inline-flex min-h-11 items-center text-body-sm font-extrabold ${FOCUS} ${
                onBlog
                  ? "text-[var(--color-main)] shadow-[inset_0_-3px_0_var(--play-cta)]"
                  : "text-[var(--color-secondary)] hover:text-[var(--color-main)]"
              }`}
            >
              {blogLabel}
            </Link>
          </nav>
          {status === "loading" ? (
            <span className="min-h-11 min-w-20" aria-hidden="true" />
          ) : (
            <Link
              href={status === "authenticated" ? "/dashboard" : "/login"}
              className={PANEL_TEXT_LINK}
            >
              {status === "authenticated" ? panelLabel : loginLabel}
            </Link>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
