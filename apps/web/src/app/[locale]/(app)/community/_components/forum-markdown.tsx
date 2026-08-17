"use client";

import { Children, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MentionText } from "./mention-text";

export function ForumMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className="break-words text-[15px] leading-7 text-[var(--color-body-text)]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{withMentions(children)}</p>,
          ul: ({ children }) => <ul className="mb-3 ml-5 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal space-y-1">{children}</ol>,
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-2 border-[var(--community-blue-border)] pl-3 text-[var(--color-secondary)]">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="font-medium text-[var(--community-blue-ink)] underline underline-offset-2"
            >
              {children}
            </a>
          ),
          code: ({ className, children }) =>
            className ? (
              <code className="my-3 block overflow-x-auto rounded-[var(--radius-card)] bg-[var(--color-soft)] p-3 font-mono text-sm">
                {children}
              </code>
            ) : (
              <code className="rounded bg-[var(--color-soft)] px-1 font-mono text-[0.9em]">
                {children}
              </code>
            ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

function withMentions(children: ReactNode): ReactNode {
  return Children.map(children, (child) =>
    typeof child === "string" ? <MentionText text={child} /> : child,
  );
}
