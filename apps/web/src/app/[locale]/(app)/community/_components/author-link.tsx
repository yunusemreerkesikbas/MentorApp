"use client";

import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";

/**
 * Wraps an author's name/avatar in a link to their forum profile (`/community/member/[username]`). When the
 * author has no username (older accounts), renders children plainly. Stops propagation so it never
 * triggers a clickable feed row's own navigation. `children` is typed from `Link` itself to avoid the
 * duplicate-@types/react mismatch a bare `ReactNode` triggers.
 */
export function AuthorLink({
  username,
  children,
  className,
  decorative = false,
}: {
  username: string | null;
  className?: string;
  /**
   * The avatar beside the name link: still clickable, but hidden from screen readers and the tab
   * order, since the avatar's initials are aria-hidden and the link would otherwise have no name.
   */
  decorative?: boolean;
  children: ComponentProps<typeof Link>["children"];
}) {
  if (!username) return <>{children}</>;
  return (
    <Link
      href={{
        pathname: "/community/member/[username]",
        params: { username },
      }}
      onClick={(e) => e.stopPropagation()}
      className={className}
      {...(decorative && { "aria-hidden": true, tabIndex: -1 })}
    >
      {children}
    </Link>
  );
}
