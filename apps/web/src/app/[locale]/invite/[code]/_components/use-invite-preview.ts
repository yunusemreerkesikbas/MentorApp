"use client";

import { useCallback, useEffect, useState } from "react";
import type { InvitePreviewView } from "@mentor/types";
import { ApiClientError } from "@mentor/api-client";
import { fetchInvitePreview } from "@/lib/economy";

export type InvitePreviewState =
  | { phase: "loading" }
  | { phase: "ready"; preview: InvitePreviewView }
  /** The API does not know this code (or it is not usable for a friend): a dead link. */
  | { phase: "invalid" }
  /** The lookup itself failed (network, throttle, server): not the link's fault, so retry is offered. */
  | { phase: "failed" };

type Settled = Exclude<InvitePreviewState, { phase: "loading" }>;

/**
 * The public preview behind the landing: the inviter's display name and the live friend discount.
 *
 * A `null` code (malformed in the URL) is a dead link without asking the API. Otherwise `loading`
 * until the lookup settles; a 404 means the link is dead, anything else is a failed lookup.
 *
 * `ready` holds the lookup back until the API client is configured. `AuthProvider` does that in
 * an effect, and a child's effect runs first, so an eager fetch would go to this site's own origin
 * (a 404 that reads as a dead link). Strict Mode's second effect pass hides it in development;
 * a production build does not.
 */
export function useInvitePreview(
  code: string | null,
  ready: boolean,
): {
  state: InvitePreviewState;
  retry: () => void;
} {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; settled: Settled } | null>(null);
  const key = `${code}#${attempt}`;

  useEffect(() => {
    if (!code || !ready) return;
    let active = true;
    fetchInvitePreview(code)
      .then((preview) => {
        if (active) setResult({ key, settled: { phase: "ready", preview } });
      })
      .catch((err: unknown) => {
        const dead = err instanceof ApiClientError && err.status === 404;
        if (active) setResult({ key, settled: { phase: dead ? "invalid" : "failed" } });
      });
    return () => {
      active = false;
    };
  }, [code, key, ready]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (!code) return { state: { phase: "invalid" }, retry };
  return { state: result?.key === key ? result.settled : { phase: "loading" }, retry };
}
