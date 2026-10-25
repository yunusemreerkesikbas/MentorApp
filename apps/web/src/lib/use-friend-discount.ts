"use client";

import { useEffect, useState } from "react";
import type { InvitePreviewView } from "@mentor/types";
import { fetchInvitePreview } from "@/lib/economy";

type FriendDiscount = InvitePreviewView["discount"];

interface FriendDiscountState {
  /** The lookup has finished (found, none, or failed). Until then nothing may be promised. */
  settled: boolean;
  /** The discount a friend gets with this code right now, or null when none is live. */
  discount: FriendDiscount;
}

/**
 * Whether a friend discount is live for the viewer's own invite code.
 *
 * Reads the public invite preview (what the friend will see), so the card never promises a number
 * the landing does not show. A failed lookup settles as "no discount": the card then states only
 * the Coin, which is always true.
 */
export function useFriendDiscount(code: string): FriendDiscountState {
  const [result, setResult] = useState<{ code: string; discount: FriendDiscount } | null>(null);

  useEffect(() => {
    let active = true;
    fetchInvitePreview(code)
      .then((preview) => {
        if (active) setResult({ code, discount: preview.discount });
      })
      .catch(() => {
        if (active) setResult({ code, discount: null });
      });
    return () => {
      active = false;
    };
  }, [code]);

  return result?.code === code
    ? { settled: true, discount: result.discount }
    : { settled: false, discount: null };
}
