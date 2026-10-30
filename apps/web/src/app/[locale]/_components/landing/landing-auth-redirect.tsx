"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAppAvailability } from "@/lib/app-availability";
import { postAuthDestination } from "@/lib/post-auth-destination";

/**
 * A signed-in visitor goes straight to the app. The page never waits for this: the web origin has
 * no session signal on the server (the refresh cookie is the API's, httpOnly), so a member may see
 * the landing for a moment first.
 */
export function LandingAuthRedirect() {
  const router = useRouter();
  const { status, user } = useAuth();
  const availability = useAppAvailability();

  useEffect(() => {
    if (status !== "authenticated" || !user) return;
    // @ts-expect-error -- a validated internal path, transported as a plain string.
    router.replace(postAuthDestination(user, null, availability));
  }, [status, user, router, availability]);

  return null;
}
