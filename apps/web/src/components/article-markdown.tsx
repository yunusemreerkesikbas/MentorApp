import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const bodyColor = "var(--color-main)";

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
        h2: ({ children }) => <h2 className="mb-3 mt-7 text-xl font-bold first:mt-0" style={{ color: bodyColor, fontFamily: "var(--font-heading)" }}>{children}</h2>,
        h3: ({ children }) => <h3 className="mb-2 mt-5 text-lg font-semibold" style={{ color: bodyColor }}>{children}</h3>,
        p: ({ children }) => <p className="mb-4 text-base leading-7" style={{ color: bodyColor }}>{children}</p>,
        ul: ({ children }) => <ul className="mb-4 list-disc space-y-1 pl-5 text-base" style={{ color: bodyColor }}>{children}</ul>,
        ol: ({ children }) => <ol className="mb-4 list-decimal space-y-1 pl-5 text-base" style={{ color: bodyColor }}>{children}</ol>,
        li: ({ children }) => <li className="leading-7">{children as ReactNode}</li>,
        a: ({ href, children }) => isSafeExternalUrl(href) ? (
          <a href={href} className="underline underline-offset-2" style={{ color: "var(--color-accent)" }} target="_blank" rel="noopener noreferrer">{children}</a>
        ) : <span>{children}</span>,
        blockquote: ({ children }) => <blockquote className="my-4 border-l-4 pl-4 text-base italic" style={{ borderColor: "var(--color-chip)", color: "var(--color-secondary)" }}>{children}</blockquote>,
      }}
    >
      {body}
    </ReactMarkdown>
  );
}
