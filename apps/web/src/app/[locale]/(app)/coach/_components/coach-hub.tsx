"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import type { DailyNextActionKind } from "@mentor/types";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCoachAccess } from "./coach-access-shell";
import { trackCoachEvent } from "@/lib/analytics";
import { CoachConversationList } from "./coach-conversation-list";
import { CoachHubBrief } from "./coach-hub-brief";
import { CoachMemoryCard } from "./coach-memory-card";
import { useCoachSession } from "./coach-session-context";

function greetingKeyForHour():
  | "greeting_morning"
  | "greeting_day"
  | "greeting_evening" {
  const hour = new Date().getHours();
  if (hour < 12) return "greeting_morning";
  if (hour < 18) return "greeting_day";
  return "greeting_evening";
}

function firstName(displayName: string): string {
  const part = displayName.trim().split(/\s+/)[0];
  return part || displayName;
}

/** /coach hub: daily continuity first; chat access is secondary. */
export function CoachHub() {
  const t = useTranslations("coach.hub");
  const tGate = useTranslations("coach.gate");
  const { user } = useAuth();
  const access = useCoachAccess();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { conversations, startNewChat } = useCoachSession();

  const [nextActionKind, setNextActionKind] =
    useState<DailyNextActionKind | null>(null);
  const hubViewTrackedRef = useRef(false);
  const accessMode = access?.mode;

  useEffect(() => {
    if (hubViewTrackedRef.current || !accessMode || !nextActionKind) return;
    hubViewTrackedRef.current = true;
    trackCoachEvent("coach_hub_view", {
      access_mode: accessMode,
      next_action_kind: nextActionKind,
    });
  }, [accessMode, nextActionKind]);

  const name = user?.displayName
    ? firstName(user.displayName)
    : t("greeting_fallback");
  const greeting = t(greetingKeyForHour(), { name });
  const mostRecent = conversations[0] ?? null;

  function goNewChat() {
    startNewChat();
    router.push("/coach/chat");
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-2xl flex-col px-5 py-6 lg:min-h-screen">
      <motion.section
        className="relative flex flex-1 flex-col overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-card)]"
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        <Image
          src="/mascot/puhu/coach-hero.png"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 640px, 100vw"
          className="object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-white/95 via-white/65 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-white via-white/80 to-transparent" />

        <div className="relative z-10 px-5 pt-7">
          <h2
            className="text-[2rem] font-bold leading-tight text-balance"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {greeting}
          </h2>
        </div>

        <div className="relative z-10 mt-auto flex flex-col gap-3 px-5 pb-6 pt-72">
          <CoachHubBrief onLoaded={setNextActionKind} />
          <CoachMemoryCard />

          {access?.canChat ? (
            <>
              <Button type="button" className="w-full" onClick={goNewChat}>
                {mostRecent ? t("new_chat") : t("start_chat")}
              </Button>
              {mostRecent ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() =>
                    router.push({
                      pathname: "/coach/chat",
                      query: { c: mostRecent.id },
                    })
                  }
                >
                  {t("continue_chat")}
                </Button>
              ) : null}
            </>
          ) : access ? (
            <div className="rounded-[var(--radius-card)] bg-white/90 px-4 py-3 shadow-[var(--shadow-card)]">
              <p
                className="text-sm font-bold"
                style={{ color: "var(--color-main)" }}
              >
                {access.reason === "AI_RATE_LIMITED"
                  ? tGate("heading_rate_limited")
                  : access.reason === "INSUFFICIENT_COIN"
                    ? tGate("heading_insufficient")
                    : tGate("heading_default")}
              </p>
              {access.reason === "INSUFFICIENT_COIN" ? (
                <Button
                  variant="secondary"
                  className="mt-2"
                  onClick={() => router.push("/profile")}
                >
                  {tGate("go_profile")}
                </Button>
              ) : access.reason === "PAYMENT_PREMIUM_REQUIRED" ? (
                <Button
                  variant="secondary"
                  className="mt-2"
                  onClick={() => router.push("/subscription")}
                >
                  {tGate("upgrade")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </motion.section>

      {access?.canChat ? <CoachConversationList /> : null}
    </main>
  );
}
