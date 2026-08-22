"use client";

import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";
import type { LegalSlug } from "@/lib/legal";

/**
 * Link to a legal document from a consent surface. Opens in a new tab so a half-filled signup or
 * checkout form is never lost, and stops propagation because every caller sits inside a `<label>`
 * — without it, reading the contract would toggle the very checkbox it belongs to.
 */
export function LegalLink({
  slug,
  children,
  tone = "accent",
}: {
  slug: LegalSlug;
  // Sourced from Link itself — the workspace resolves two @types/react copies, so a bare
  // `ReactNode` import here is a different type than the one Link expects.
  children: ComponentProps<typeof Link>["children"];
  /** `plain` follows `--color-main` — for dark consent surfaces. */
  tone?: "accent" | "plain";
}) {
  return (
    <Link
      href={{ pathname: "/legal/[slug]", params: { slug } }}
      target="_blank"
      onClick={(e) => e.stopPropagation()}
      className="underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2"
      style={{
        color: tone === "plain" ? "var(--color-main)" : "var(--color-accent)",
      }}
    >
      {children}
    </Link>
  );
}
