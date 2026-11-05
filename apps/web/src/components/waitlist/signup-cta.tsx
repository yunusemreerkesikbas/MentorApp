"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useAppAvailability } from "@/lib/app-availability";
import { isWaitlistOn } from "@/lib/signup-waitlist";
import { Link } from "@/i18n/navigation";

type Href = ComponentProps<typeof Link>["href"];

const loadWaitlistModal = () => import("./waitlist-modal").then((module) => module.WaitlistModal);
/** The card is portalled to `document.body`: client only, and its code arrives on first intent. */
export const LazyWaitlistModal = dynamic(loadWaitlistModal, { ssr: false });

/**
 * A signup CTA that respects invite-only signup. Open signup → the plain link. Waitlist on (or no
 * availability snapshot: fail closed) → a button that opens the waitlist card; the card's code is
 * fetched on first intent, not with the page.
 */
export function SignupCta({
  href,
  role,
  className,
  children,
}: {
  href: Href;
  role: "student" | "coach";
  className: string;
  children: ReactNode;
}) {
  const waitlist = isWaitlistOn(useAppAvailability());
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // The card unmounts without `dialog.close()`, so focus is handed back to the CTA by hand.
  useEffect(() => {
    if (wasOpen.current && !open) buttonRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  if (!waitlist) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        className={`${className} cursor-pointer`}
        onClick={() => setOpen(true)}
        onPointerEnter={() => void loadWaitlistModal()}
        onFocus={() => void loadWaitlistModal()}
      >
        {children}
      </button>
      {open ? <LazyWaitlistModal role={role} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
