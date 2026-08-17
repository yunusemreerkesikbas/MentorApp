import { ChevronLeft, X } from "lucide-react";
import type { ComponentProps } from "react";

import { Link } from "@/i18n/navigation";

type CircularBackLinkProps = {
  href: ComponentProps<typeof Link>["href"];
  label: string;
  variant?: "outlined" | "soft";
  icon?: "chevron" | "close";
  className?: string;
};

const variantClasses = {
  outlined:
    "border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] hover:bg-[var(--color-soft)]",
  soft: "border-transparent bg-[color-mix(in_srgb,var(--color-main)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-main)_10%,transparent)]",
} as const;

/** Locale-aware, accessible circular navigation control for returning to a parent surface. */
export function CircularBackLink({
  href,
  label,
  variant = "outlined",
  icon = "chevron",
  className = "",
}: CircularBackLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={[
        "grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full border text-[var(--color-main)]",
        "transition-[background-color,transform] duration-150 ease-out",
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon === "close" ? (
        <X size={19} strokeWidth={2} aria-hidden />
      ) : (
        <ChevronLeft size={20} strokeWidth={2} aria-hidden />
      )}
    </Link>
  );
}
