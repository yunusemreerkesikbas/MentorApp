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
      <Link href={href} className="text-sm" style={{ color: "var(--color-accent)" }}>
        {label}
      </Link>
    </nav>
  );
}
