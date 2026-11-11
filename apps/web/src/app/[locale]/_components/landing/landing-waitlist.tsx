"use client";

import { useSearchParams } from "next/navigation";
import { LazyWaitlistModal } from "@/components/waitlist/signup-cta";
import { useRouter } from "@/i18n/navigation";
import { useAppAvailability } from "@/lib/app-availability";
import { isWaitlistOn } from "@/lib/signup-waitlist";

export function LandingWaitlist() {
  const role = useSearchParams().get("waitlist");
  const router = useRouter();
  const waitlist = isWaitlistOn(useAppAvailability());

  if (!waitlist || (role !== "student" && role !== "coach")) return null;

  return (
    <LazyWaitlistModal
      role={role}
      onClose={() => router.replace("/", { scroll: false })}
      onLogin={() => undefined}
    />
  );
}
