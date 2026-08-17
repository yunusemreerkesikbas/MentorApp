"use client";

import { useTranslations } from "next-intl";
import { Card } from "@mentor/ui";

/** Editorial trust footer — guardrail §4 #1 (verified source, not LLM-generated). */
export function ArticleTrustFooter() {
  const translate = useTranslations("article");
  return (
    <footer className="mt-8">
      <Card className="!bg-[color-mix(in_srgb,var(--color-surface)_50%,transparent)]">
        <div className="flex flex-col gap-3">
          <span
            className="rounded-[var(--radius-card)] px-3 py-1.5 text-xs font-bold"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-chip) 30%, transparent)",
              color: "var(--color-chip-text)",
              fontFamily: "var(--font-body)",
            }}
          >
            {translate("trust_badge")}
          </span>
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-secondary)" }}>
            {translate("trust_body")}
          </p>
        </div>
      </Card>
    </footer>
  );
}
