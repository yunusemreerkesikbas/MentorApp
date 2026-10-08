import { Fragment, type ComponentProps } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export type DetailCrumbItem = { label: string; href?: ComponentProps<typeof Link>["href"] };

/**
 * A detail page's "where am I" line (Topluluk › room › this page); the crumb without a link is the
 * page. A `null` entry (say, a room that did not load) is skipped. One line always: a long page
 * title is cut short rather than wrapped under the links (the page's own heading repeats it).
 */
export function DetailCrumb({ items }: { items: Array<DetailCrumbItem | null> }) {
  const t = useTranslations("community");
  return (
    <nav
      aria-label={t("breadcrumb_label")}
      className="flex min-w-0 items-center gap-1 text-caption font-bold text-[var(--color-secondary)]"
    >
      {items.filter((item) => item !== null).map((item, index) => (
        <Fragment key={index}>
          {index > 0 ? <ChevronRight size={14} className="shrink-0" aria-hidden /> : null}
          {item.href ? (
            <Link
              href={item.href}
              className="inline-flex min-h-11 min-w-0 items-center underline-offset-4 hover:text-[var(--color-main)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              {/* A long room name gives way too, so the line never runs past a phone's edge. */}
              <span className="truncate">{item.label}</span>
            </Link>
          ) : (
            <span aria-current="page" className="min-w-0 max-w-[24rem] truncate text-[var(--color-main)]">
              {item.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
