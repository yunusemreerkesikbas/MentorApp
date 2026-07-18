"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";

/** Back link: authenticated users → hub; anonymous SEO visitors → home. */
export function ArticleBackNav() {
  const t = useTranslations("article");
  const { status } = useAuth();
  const authenticated = status === "authenticated";

  return (
    <nav className="mb-4">
      <Link
        href={authenticated ? "/bilgi" : "/"}
        className="inline-flex min-h-11 items-center text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
        style={{
          color: "var(--color-accent)",
          fontFamily: "var(--font-heading)",
        }}
      >
        <span aria-hidden="true">←</span>
        <span className="ml-1">
          {t(authenticated ? "back_knowledge" : "back_home")}
        </span>
      </Link>
    </nav>
  );
}
