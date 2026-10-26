"use client";

import { useEffect, useState } from "react";
import type { InviteCodeView } from "@mentor/types";
import { fetchInviteCode } from "@/lib/economy";

export type OwnInviteState =
  | { phase: "loading" }
  | { phase: "ready"; view: InviteCodeView }
  /** The lookup failed: nothing is known about whether this person can still use an invite. */
  | { phase: "failed" };

/**
 * The signed-in student's own invite view (`GET /economy/invite`): whether they already came with
 * someone's invite, or can still use one at all (never paid, inside the signup window). The landing
 * reads it so it never offers an accept button or a discount the API would then refuse.
 *
 * Asked only while `enabled` (a signed-in, onboarded student; a coach would get a 403), and in
 * parallel with the public preview, so the skeleton waits for the slower of the two.
 */
export function useOwnInvite(enabled: boolean): OwnInviteState {
  const [settled, setSettled] = useState<Exclude<OwnInviteState, { phase: "loading" }> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    fetchInviteCode()
      .then((view) => {
        if (active) setSettled({ phase: "ready", view });
      })
      .catch(() => {
        if (active) setSettled({ phase: "failed" });
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  return settled ?? { phase: "loading" };
}
