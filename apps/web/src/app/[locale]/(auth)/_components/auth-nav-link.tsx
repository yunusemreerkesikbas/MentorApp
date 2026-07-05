import { Link } from "@/i18n/navigation";

/** Auth footer/nav link — 44px touch, no bare underline. */
export function AuthNavLink({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
      style={{ color: "var(--color-accent)", fontFamily: "var(--font-heading)" }}
    >
      {children}
    </Link>
  );
}
