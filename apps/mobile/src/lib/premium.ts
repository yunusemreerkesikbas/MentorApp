import { useQuery } from "@tanstack/react-query";
import { http } from "@mentor/api-client";
import { isCoach } from "@mentor/core";
import type { DailyGreetingDto, SubscriptionView } from "@mentor/types";
import { useAuth } from "../providers/auth-provider.js";

/**
 * Premium on the phone is read-only for now: there is no in-app purchase yet, so the app never
 * sells or teases Premium. A student who subscribed on the web still gets what they paid for:
 * the hero mask by their name, Puhu in his mask, and the daily note.
 */
async function fetchSubscription(): Promise<SubscriptionView | null> {
  try {
    return (await http<SubscriptionView>("/v1/subscription")) as SubscriptionView;
  } catch {
    return null;
  }
}

/** A student's Premium standing. A coach's plan is not shown as a student's Premium. */
export function useIsPremium(): boolean {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["subscription"],
    queryFn: fetchSubscription,
    staleTime: 60_000,
    enabled: Boolean(user),
  });
  return Boolean(data?.entitlement.isPremium) && !isCoach(user);
}

/** The Premium daily note for the panel's bubble; null for free users and while it is written. */
export function useDailyGreeting(): string | null {
  const premium = useIsPremium();
  const { data } = useQuery({
    queryKey: ["coach", "daily-greeting"],
    queryFn: async () =>
      ((await http<DailyGreetingDto>("/v1/coach/daily-greeting", { method: "POST" })) as DailyGreetingDto)
        .greeting,
    // The server refuses a free user, so the request waits for the entitlement.
    enabled: premium,
    staleTime: 6 * 60 * 60_000,
    retry: false,
  });
  return data ?? null;
}

/** Premium Puhu's hero mask on a 24 grid (the web's `premium-mask.ts`): outline, eye holes, rims. */
export const PREMIUM_MASK_OUTLINE =
  "M1.2 7Q1.25 5.6 2.1 6.25C3 7.1 4 7.7 5.3 7.7C7.2 7.6 8.7 7.3 10.2 8Q12 8.8 13.8 8C15.3 7.3 16.8 7.6 18.7 7.7C20 7.7 21 7.1 21.9 6.25Q22.75 5.6 22.8 7C22.9 9.6 22.4 12.6 21.2 14.8C20.2 16.6 18.6 17.7 16.6 17.7C15 17.7 14 16.9 13.3 15.8Q12 14.2 10.7 15.8C10 16.9 9 17.7 7.4 17.7C5.4 17.7 3.8 16.6 2.8 14.8C1.6 12.6 1.1 9.6 1.2 7Z";
export const PREMIUM_MASK_EYES =
  "M3.8 12.4a3.6 3.1 0 1 0 7.2 0a3.6 3.1 0 1 0-7.2 0ZM13 12.4a3.6 3.1 0 1 0 7.2 0a3.6 3.1 0 1 0-7.2 0Z";
