import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";

/** Auth footer/nav link look — 44px touch, no bare underline. Shared with link-shaped buttons. */
export const AUTH_NAV_LINK =
  "inline-flex min-h-11 items-center text-sm font-semibold font-heading text-[var(--color-accent)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none";

/** Auth footer/nav link — 44px touch, no bare underline. */
export function AuthNavLink({
  href,
  children,
}: {
  href: ComponentProps<typeof Link>["href"];
  children: string;
}) {
  return (
    <Link href={href} className={AUTH_NAV_LINK}>
      {children}
    </Link>
  );
}
