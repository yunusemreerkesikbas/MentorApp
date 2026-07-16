"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function isSafeExternalUrl(href: string | undefined): href is string {
  return (
    typeof href === "string" &&
    (href.startsWith("https://") || href.startsWith("http://"))
  );
}

/**
 * Minimal markdown for coach bubbles: paragraphs, bold/italic, lists. No raw HTML (react-markdown
 * default); headings/blockquotes/code fall back to plain paragraphs — a chat bubble is not an
 * editorial page (see `article-markdown.tsx` for that).
 */
export function CoachMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => (
          <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        // ponytail: prompt forbids headings/code/links — these mappings are just the safety net.
        h1: ({ children }) => <p className="mb-2 font-bold last:mb-0">{children}</p>,
        h2: ({ children }) => <p className="mb-2 font-bold last:mb-0">{children}</p>,
        h3: ({ children }) => <p className="mb-2 font-bold last:mb-0">{children}</p>,
        blockquote: ({ children }) => <div className="mb-2 last:mb-0">{children}</div>,
        pre: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        code: ({ children }) => <span>{children}</span>,
        a: ({ href, children }) =>
          isSafeExternalUrl(href) ? (
            <a
              href={href}
              className="underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ) : (
            <span>{children}</span>
          ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
