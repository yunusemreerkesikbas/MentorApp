import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Reading type shared by blog posts and legal documents; `.mentor-article-body` mirrors it for HTML. */
const PROSE = "text-base font-semibold leading-7 text-[var(--color-body)] sm:text-lg sm:leading-8";
const LIST = `mb-5 space-y-1.5 pl-6 ${PROSE} marker:font-extrabold marker:text-[var(--color-secondary)]`;
const CELL = "border-b border-[var(--color-border)] px-3 py-2.5 text-left align-top";

function isSafeExternalUrl(href: string | undefined): href is string {
  return typeof href === "string" && (href.startsWith("https://") || href.startsWith("http://"));
}

/** Shared editorial/legal markdown body. Raw HTML and unsafe link schemes are never rendered. */
export function ArticleMarkdown({ body, format }: { body: string; format: "MARKDOWN" | "HTML" }) {
  if (format === "HTML") {
    return <div className="mentor-article-body" dangerouslySetInnerHTML={{ __html: body }} />;
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h2: ({ children }) => (
          <h2 className="mb-3 mt-9 text-balance text-xl font-extrabold leading-snug text-[var(--color-main)] first:mt-0 sm:text-title">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-2 mt-7 text-lg font-extrabold leading-snug text-[var(--color-main)]">
            {children}
          </h3>
        ),
        p: ({ children }) => <p className={`mb-5 text-pretty ${PROSE}`}>{children}</p>,
        ul: ({ children }) => <ul className={`${LIST} list-disc`}>{children}</ul>,
        ol: ({ children }) => <ol className={`${LIST} list-decimal`}>{children}</ol>,
        li: ({ children }) => <li className="pl-1">{children as ReactNode}</li>,
        strong: ({ children }) => (
          <strong className="font-extrabold text-[var(--color-main)]">{children}</strong>
        ),
        a: ({ href, children }) =>
          isSafeExternalUrl(href) ? (
            <a
              href={href}
              className="font-extrabold text-[var(--play-selected-ink)] underline underline-offset-4"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ) : (
            <span>{children}</span>
          ),
        // A tinted block, not the old 4px side stripe (DESIGN §8.6).
        blockquote: ({ children }) => (
          <blockquote className="mb-5 rounded-[var(--radius-card)] bg-[var(--play-selected)] px-5 py-4 [&>p]:mb-0">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <table className="mb-5 block w-full border-collapse overflow-x-auto">{children}</table>
        ),
        th: ({ children }) => (
          <th className={`${CELL} text-sm font-extrabold text-[var(--color-main)]`}>{children}</th>
        ),
        td: ({ children }) => (
          <td className={`${CELL} text-base font-semibold text-[var(--color-body)]`}>{children}</td>
        ),
      }}
    >
      {body}
    </ReactMarkdown>
  );
}
