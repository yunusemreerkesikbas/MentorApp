"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import { loadTurnstile, type TurnstileApi } from "@/lib/turnstile";

export const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();

export function SignupTurnstile({ onToken, resetKey }: {
  onToken: (token: string | null) => void;
  resetKey: number;
}) {
  const translate = useTranslations("auth.turnstile");
  const container = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState("loading");

  useEffect(() => {
    if (!turnstileSiteKey) return;
    let cancelled = false;
    let widgetId: string | undefined;
    let api: TurnstileApi | undefined;
    void loadTurnstile().then((loadedApi) => {
      if (cancelled || !container.current) return;
      api = loadedApi;
      widgetId = api.render(container.current, {
        sitekey: turnstileSiteKey,
        action: "signup",
        callback: (token) => { if (!cancelled) { onToken(token); setState("ready"); } },
        "expired-callback": () => { if (!cancelled) { onToken(null); setState("expired"); } },
        "error-callback": () => { if (!cancelled) { onToken(null); setState("error"); } },
      });
    }).catch(() => { if (!cancelled) { onToken(null); setState("error"); } });
    return () => {
      cancelled = true;
      if (widgetId !== undefined) api?.remove(widgetId);
    };
  }, [attempt, onToken, resetKey]);

  if (!turnstileSiteKey) return null;
  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={container} />
      {state === "error" || state === "expired" ? (
        <>
          <p role="status" className="text-sm">{translate(state)}</p>
          <Button type="button" variant="ghost" onClick={() => {
            onToken(null);
            setState("loading");
            setAttempt((value) => value + 1);
          }}>{translate("retry")}</Button>
        </>
      ) : null}
    </div>
  );
}
