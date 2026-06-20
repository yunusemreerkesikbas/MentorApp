"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const bodyColor = "var(--color-main)";
const mutedColor = "var(--color-secondary)";

function isSafeExternalUrl(href: string | undefined): href is string {
  return (
    typeof href === "string" &&
    (href.startsWith("https://") || href.startsWith("http://"))
  );
}

/** Editorial markdown body — no raw HTML; external links limited to http(s) (guardrail XSS). */
export function ArticleMarkdown({ body }: { body: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h2: ({ children }) => (
          <h2
            className="mb-3 mt-6 text-xl font-bold first:mt-0"
            style={{ color: bodyColor, fontFamily: "var(--font-heading)" }}
          >
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-2 mt-4 text-lg font-semibold" style={{ color: bodyColor }}>
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="mb-3 text-base leading-relaxed" style={{ color: bodyColor }}>
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="mb-3 list-disc space-y-1 pl-5 text-base" style={{ color: bodyColor }}>
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-3 list-decimal space-y-1 pl-5 text-base" style={{ color: bodyColor }}>
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children as ReactNode}</li>,
        a: ({ href, children }) => {
          if (!isSafeExternalUrl(href)) {
            return <span>{children}</span>;
          }
          return (
            <a
              href={href}
              className="underline underline-offset-2"
              style={{ color: "var(--color-accent)" }}
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          );
        },
        blockquote: ({ children }) => (
          <blockquote
            className="my-4 border-l-4 pl-4 text-base italic"
            style={{ borderColor: "var(--color-chip)", color: mutedColor }}
          >
            {children}
          </blockquote>
        ),
      }}
    >
      {body}
    </ReactMarkdown>
  );
}

/** Minimal public chrome for SEO article pages (no auth shell). */
export function PublicArticleChrome({ children }: { children: ReactNode }) {
  const translate = useTranslations("article");
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
            href="/giris"
            className="inline-flex min-h-[44px] items-center text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
            style={{ color: "var(--color-accent)", fontFamily: "var(--font-heading)" }}
          >
            {translate("login")}
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
