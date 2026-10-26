"use client";

import { useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { isCoach } from "@/lib/coach-surface";
import { fetchInviteCode, peekInviteCode } from "@/lib/economy";
import { buildInviteLink } from "@/lib/invite-link";
import { useMentorToast } from "@/lib/mentor-toast";
import { getProfileLinks } from "@/lib/profile-links";

/** How long a tap waits for the invite code when the page was not already holding it. */
const INVITE_LOOKUP_MS = 1500;

/** Rejects after `ms`; the underlying request keeps going and still lands in the code cache. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/**
 * The settings "Tavsiye et" row. A student shares their personal invite link, so a friend who
 * comes from here is attributed to them; a coach (outside the referral program), and anyone whose
 * code cannot be had in time, shares the generic site URL.
 *
 * The share sheet has to open inside the tap: iOS Safari rejects `navigator.share` once a network
 * round trip separates it from the gesture. So the code comes from what the Davet et card already
 * fetched (`peekInviteCode`) and the sheet opens synchronously; only when the page never held it
 * does the tap wait, for a bounded `INVITE_LOOKUP_MS`. A share the browser still refuses (anything
 * but the user closing the sheet) is copied to the clipboard instead, as the invite card does.
 */
export function useRecommendShare(): () => Promise<void> {
  const t = useTranslations("profile.support");
  const locale = useLocale();
  const toast = useMentorToast();
  const { user } = useAuth();
  const links = getProfileLinks();
  // One tap, one share sheet: a second tap while a lookup or a sheet is open is ignored.
  const sharingRef = useRef(false);

  function knownUrl(): string | null {
    if (isCoach(user)) return links.shareUrl;
    const code = peekInviteCode();
    return code ? buildInviteLink(code, locale) : null;
  }

  async function lookUpUrl(): Promise<string> {
    try {
      const { code } = await withTimeout(fetchInviteCode(), INVITE_LOOKUP_MS);
      return buildInviteLink(code, locale);
    } catch {
      // Economy off, network, throttle, 403, too slow: the generic link, and the share still happens.
      return links.shareUrl;
    }
  }

  async function send(url: string) {
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: t("share_title"), text: t("share_text"), url });
          return;
        } catch (err) {
          // A dismissed share sheet is an answer, not a failure: no copy behind their back.
          if (err instanceof DOMException && err.name === "AbortError") return;
        }
      }
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(url);
      toast.success({
        title: t("share_copied_title"),
        message: t("share_copied_message"),
        duration: 3000,
      });
    } catch {
      toast.error({
        title: t("share_error_title"),
        message: t("share_error_message"),
        duration: 3000,
      });
    }
  }

  return async function recommend() {
    if (sharingRef.current) return;
    sharingRef.current = true;
    try {
      // `??` short-circuits: with the url in hand there is no await before `navigator.share`.
      await send(knownUrl() ?? (await lookUpUrl()));
    } finally {
      sharingRef.current = false;
    }
  };
}
