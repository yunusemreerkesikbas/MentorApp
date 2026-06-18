"use client";

import Link from "next/link";
import { useAuth } from "../../../../lib/auth-context";

/** Back link: authenticated users → hub; anonymous SEO visitors → home (avoids auth wall). */
export function ArticleBackNav() {
  const { status } = useAuth();
  const href = status === "authenticated" ? "/bilgi" : "/";
  const label = status === "authenticated" ? "← Bilgi Merkezi" : "← Ana sayfa";

  return (
    <nav className="mb-4">
      <Link
        href={href}
        className="inline-flex min-h-[44px] items-center text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
        style={{ color: "var(--color-accent)", fontFamily: "var(--font-heading)" }}
      >
        {label}
      </Link>
    </nav>
  );
}
