"use client";

import type { ComponentProps, ReactNode } from "react";
import { SignupCta } from "@/components/waitlist/signup-cta";
import type { SeoLpSlug } from "@/lib/analytics";
import { trackSeoLpSignupClick } from "@/lib/lp-attribution";

type Href = ComponentProps<typeof SignupCta>["href"];

export function SeoSignupCta({
  href = "/welcome",
  role = "student",
  source,
  location,
  className,
  children,
}: {
  href?: Href;
  role?: "student" | "coach";
  source: SeoLpSlug;
  location:
    | "hero"
    | "demo"
    | "table"
    | "timer_done"
    | "closing"
    | "parent"
    | "how"
    | "features";
  className: string;
  children: ReactNode;
}) {
  return (
    <SignupCta
      href={href}
      role={role}
      className={className}
      onClick={() => trackSeoLpSignupClick(source, location, role)}
    >
      {children}
    </SignupCta>
  );
}
