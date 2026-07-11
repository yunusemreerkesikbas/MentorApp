"use client";

import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw.mjs";
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCoachSession } from "./coach-session-context";
import { KocHubBrief } from "./koc-hub-brief";
import { KocHubSkeleton } from "./koc-content-skeleton";

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

/**
 * /koc hub — generated hero poster, start/continue chat CTAs.
 */
export function KocHub() {
  const t = useTranslations("coach.hub");
  const { user } = useAuth();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { hasActiveChat, startNewChat, hydrated } = useCoachSession();

  const name = user?.displayName
    ? firstName(user.displayName)
    : t("greeting_fallback");
  const greeting = t(greetingKeyForHour(), { name });

  function goNewChat() {
    startNewChat();
    router.push("/koc/chat");
  }

  if (!hydrated) {
    return <KocHubSkeleton />;
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
          src="/mascot/puhu/koc-hero.png"
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
          <KocHubBrief />
          <Button type="button" className="w-full" onClick={goNewChat}>
            {t("start_chat")}
          </Button>
          {hasActiveChat ? (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => router.push("/koc/chat")}
            >
              {t("continue_chat")}
            </Button>
          ) : null}
          {hasActiveChat ? (
            <button
              type="button"
              onClick={goNewChat}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 text-sm font-bold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
              style={{ color: "var(--color-progress)" }}
            >
              <RefreshCw className="size-4" aria-hidden />
              {t("new_chat")}
            </button>
          ) : null}
        </div>
      </motion.section>

    </main>
  );
}
