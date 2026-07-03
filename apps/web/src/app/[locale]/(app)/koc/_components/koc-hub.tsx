"use client";

import BookOpen from "lucide-react/dist/esm/icons/book-open.mjs";
import CalendarDays from "lucide-react/dist/esm/icons/calendar-days.mjs";
import Heart from "lucide-react/dist/esm/icons/heart.mjs";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw.mjs";
import Route from "lucide-react/dist/esm/icons/route.mjs";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { CoachAccessMode } from "@mentor/types";
import { Button } from "@mentor/ui";
import { PuhuCoachBubble } from "@/components/puhu-coach-bubble";
import { useAuth } from "@/lib/auth-context";
import { Link, useRouter } from "@/i18n/navigation";
import { useKocAccess } from "./koc-access-shell";
import { useCoachSession } from "./coach-session-context";
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

function chatHref(seed: string): `/koc/chat?seed=${string}` {
  return `/koc/chat?seed=${encodeURIComponent(seed)}`;
}

/** Hub shortcuts — seed text matches panel coach shortcuts where applicable. */
function useShortcuts() {
  const t = useTranslations("coach.hub");
  const tChat = useTranslations("coach_chat");
  return [
    {
      key: "study",
      title: t("shortcut_study_title"),
      sub: t("shortcut_study_sub"),
      seed: tChat("suggestion_1"),
      icon: CalendarDays,
    },
    {
      key: "anxiety",
      title: t("shortcut_anxiety_title"),
      sub: t("shortcut_anxiety_sub"),
      seed: tChat("suggestion_2"),
      icon: Heart,
    },
    {
      key: "plan",
      title: t("shortcut_plan_title"),
      sub: t("shortcut_plan_sub"),
      seed: tChat("suggestion_3"),
      icon: Route,
    },
    {
      key: "subject",
      title: t("shortcut_subject_title"),
      sub: t("shortcut_subject_sub"),
      seed: t("subject_turkish"),
      icon: BookOpen,
    },
  ] as const;
}

function useSubjects() {
  const t = useTranslations("coach.hub");
  return [
    { key: "turkish", label: t("subject_turkish"), seed: t("subject_turkish") },
    { key: "math", label: t("subject_math"), seed: t("subject_math") },
    {
      key: "general",
      label: t("subject_general"),
      seed: t("subject_general"),
    },
    {
      key: "motivation",
      label: t("subject_motivation"),
      seed: t("subject_motivation"),
    },
  ] as const;
}

/**
 * /koc hub — greeting, shortcut cards, session pills, start/continue chat CTAs.
 */
export function KocHub() {
  const tCoach = useTranslations("coach");
  const t = useTranslations("coach.hub");
  const access = useKocAccess();
  const { user } = useAuth();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { recentTopics, hasActiveChat, startNewChat, hydrated } =
    useCoachSession();
  const shortcuts = useShortcuts();
  const subjects = useSubjects();

  const name = user?.displayName
    ? firstName(user.displayName)
    : t("greeting_fallback");
  const greeting = t(greetingKeyForHour(), { name });

  const subtitle =
    access.mode === CoachAccessMode.COIN
      ? tCoach("subtitle_coin")
      : tCoach("subtitle_premium");

  const headerMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.3, ease: "easeOut" as const },
        },
      };

  function goNewChat() {
    startNewChat();
    router.push("/koc/chat");
  }

  if (!hydrated) {
    return <KocHubSkeleton />;
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-2xl flex-col lg:min-h-screen">
      <motion.header className="px-5 pt-8" {...headerMotion}>
        <div>
          <h1
            className="text-2xl font-bold"
            style={{
              color: "var(--color-main)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {tCoach("title")}
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--color-secondary)" }}
          >
            {subtitle}
          </p>
        </div>
      </motion.header>

      <div className="flex flex-1 flex-col gap-6 px-5 py-6">
        <motion.div
          className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="relative min-w-0 flex-1">
            <div
              className="pointer-events-none absolute -left-4 top-0 h-32 w-48 rounded-full opacity-40 blur-3xl"
              style={{ backgroundColor: "var(--color-progress-track)" }}
              aria-hidden
            />
            <h2
              className="relative text-[1.75rem] font-bold leading-tight"
              style={{
                color: "var(--color-main)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {greeting}
            </h2>
            <p
              className="relative mt-2 max-w-[280px] text-base"
              style={{ color: "var(--color-body)", fontFamily: "var(--font-body)" }}
            >
              {t("prompt_line")}
            </p>
          </div>
          <PuhuCoachBubble
            message={t("bubble_welcome")}
            variant="default"
            puhuSize={72}
            dismissLabel={t("bubble_dismiss")}
            className="shrink-0 self-end sm:self-auto"
          />
        </motion.div>

        <div className="grid grid-cols-2 gap-3">
          {shortcuts.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.key}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.2 }}
              >
                <Link
                  href={chatHref(item.seed)}
                  className="flex min-h-[88px] cursor-pointer flex-col gap-2 rounded-[var(--radius-card)] border border-white bg-white p-4 shadow-[var(--shadow-card)] transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none lg:min-h-[96px]"
                >
                  <Icon
                    className="size-6 shrink-0"
                    style={{ color: "var(--color-progress)" }}
                    aria-hidden
                  />
                  <div>
                    <p
                      className="text-base font-bold leading-snug"
                      style={{
                        color: "var(--color-main)",
                        fontFamily: "var(--font-heading)",
                      }}
                    >
                      {item.title}
                    </p>
                    <p
                      className="mt-0.5 text-[13px] leading-snug"
                      style={{ color: "var(--color-secondary)" }}
                    >
                      {item.sub}
                    </p>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {subjects.map((subject) => (
            <Link
              key={subject.key}
              href={chatHref(subject.seed)}
              className="min-h-11 shrink-0 cursor-pointer rounded-[var(--radius-card)] px-3 py-2 text-sm font-bold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--color-chip) 30%, transparent)",
                color: "var(--color-chip-text)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              {subject.label}
            </Link>
          ))}
        </div>

        {recentTopics.length > 0 ? (
          <section>
            <h3
              className="text-sm font-bold"
              style={{
                color: "var(--color-main)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {t("recent_topics_title")}
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {recentTopics.map((topic) => (
                <Link
                  key={topic}
                  href={chatHref(topic)}
                  className="min-h-9 cursor-pointer rounded-[var(--radius-card)] border border-white bg-white/50 px-3 py-1.5 text-sm font-bold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
                  style={{
                    color: "var(--color-chip-text)",
                    boxShadow: "var(--shadow-card)",
                  }}
                >
                  {topic}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-auto flex flex-col gap-3 pb-4">
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
      </div>
    </main>
  );
}
