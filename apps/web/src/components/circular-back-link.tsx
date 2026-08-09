import { ChevronLeft } from "lucide-react";
import type { ComponentProps } from "react";

import { Link } from "@/i18n/navigation";

type CircularBackLinkProps = {
  href: ComponentProps<typeof Link>["href"];
  label: string;
  variant?: "outlined" | "soft";
  className?: string;
};

const variantClasses = {
  outlined:
    "border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] hover:bg-[var(--color-soft)]",
  soft: "border-transparent bg-black/5 hover:bg-black/10",
} as const;

/** Locale-aware, accessible circular navigation control for returning to a parent surface. */
export function CircularBackLink({
  href,
  label,
  variant = "outlined",
  className = "",
}: CircularBackLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={[
        "grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full border text-[var(--color-main)]",
        "transition-[background-color,transform] duration-150 ease-out hover:-translate-x-0.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2",
        "motion-reduce:transform-none motion-reduce:transition-none",
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <ChevronLeft size={20} strokeWidth={2} aria-hidden />
    </Link>
  );
}
