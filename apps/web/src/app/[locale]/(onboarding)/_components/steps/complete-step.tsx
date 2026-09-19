"use client";

import { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Backpack, Bell, CalendarDays, GraduationCap, Landmark, Target, Timer, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AuthUser, CareerGroup } from "@mentor/types";
import { Button, StreamingText } from "@mentor/ui";
import { PlayIconWell, type PlayWell } from "@/components/onboarding-play/play-choice";
import { PlayFooter } from "@/components/onboarding-play/play-footer";
import { useRouter } from "@/i18n/navigation";
import { useCloudTransition } from "@/lib/cloud-transition";
import { consumePendingInvite } from "@/lib/pending-invite";
import { onboardingDestination, type OnboardingAudience } from "../onboarding-flow";
import { ReadyWindow } from "./ready-window";

const EXAM_ICON = { KPSS: Landmark, YKS: GraduationCap, LGS: Backpack } as const;

export type ReadySummary = {
  dailyGoalMinutes: number | null;
  careerGroup: CareerGroup | null;
  /** True only when this browser really subscribed to push. */
  reminder: boolean;
};

type Row = { icon: LucideIcon; well: PlayWell; title: string; sub?: string };

/** "Yolun hazır": a one-way door. What they chose, where the countdown lives, then the cloud cover. */
export function CompleteStep({
  user,
  audience,
  summary,
  onFinish,
}: {
  user: AuthUser;
  audience: OnboardingAudience;
  summary: ReadySummary;
  onFinish: () => void;
}) {
  const t = useTranslations("onboarding.complete");
  const examCopy = useTranslations("profile.exam_settings");
  const career = useTranslations("vision.career");
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { startCloudTransition } = useCloudTransition();
  const leaving = useRef(false);
  const [titleDone, setTitleDone] = useState(false);
  const title = audience === "coach" ? t("title_coach") : t("title");
  // A new coach's invite code stays shut until the email is verified; say so before they find a locked panel.
  const body = audience === "coach" ? t("verify_email_coach") : t("subtitle");

  function finish() {
    if (leaving.current) return;
    leaving.current = true;
    onFinish();
    try {

    } catch {}
    const destination = onboardingDestination(consumePendingInvite(), audience);
    startCloudTransition(() => {
      // @ts-expect-error validated internal destination may be transported as a string.
      router.replace(destination);
    });
  }

  const rows: Row[] = [];
  if (user.examType) {
    const level = user.examType === "KPSS" && user.examVariant ? ` · ${examCopy(`variant.${user.examVariant}`)}` : "";
    rows.push({ icon: EXAM_ICON[user.examType], well: "blue", title: `${user.examType}${level}` });
  }
  if (summary.dailyGoalMinutes) rows.push({ icon: Timer, well: "peri", title: t("summary_goal", { minutes: summary.dailyGoalMinutes }) });
  if (summary.careerGroup) rows.push({ icon: Target, well: "coral", title: t("summary_field", { field: career(`group.${summary.careerGroup}`) }) });
  if (summary.reminder) rows.push({ icon: Bell, well: "violet", title: t("summary_reminder") });
  if (audience === "student") rows.push({ icon: CalendarDays, well: "blue", title: t("countdown_title"), sub: t("countdown_source") });

  return (
    <main className="onboarding-play-theme flex min-h-dvh w-full flex-col bg-[var(--color-bg)]">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
        <section className="flex flex-1 flex-col items-center gap-4 px-5 pt-12">
          <ReadyWindow career={summary.careerGroup} />
          <div className="mt-2 flex flex-col items-center gap-2 text-center">
            <h1 className="text-[2rem] font-extrabold leading-tight text-[var(--color-main)]">
              <StreamingText text={title} onComplete={() => setTitleDone(true)} />
            </h1>
            <p className="max-w-[19rem] text-pretty text-base font-medium leading-relaxed text-[var(--color-body)]">
              {titleDone ? <StreamingText text={body} /> : <span className="invisible">{body}</span>}
            </p>
          </div>
          <ul
            aria-label={t("summary_label")}
            className="flex w-full flex-col rounded-[var(--play-radius)] border-2 border-[var(--play-line)] bg-[var(--color-surface)] px-4 py-1"
          >
            {rows.map(({ icon: Icon, well, title, sub }, index) => (
              <motion.li
                key={title}
                className={`flex min-h-14 items-center gap-3 py-2 ${index ? "border-t-2 border-[var(--play-line)]" : ""}`}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: "easeOut", delay: 0.18 + index * 0.07 }}
              >
                <PlayIconWell well={well} className="size-9">
                  <Icon size={18} />
                </PlayIconWell>
                <span className="flex flex-col">
                  <span className="text-base font-bold leading-snug text-[var(--color-main)]">{title}</span>
                  {sub ? <span className="text-sm font-medium text-[var(--color-secondary)]">{sub}</span> : null}
                </span>
              </motion.li>
            ))}
          </ul>
        </section>
        <PlayFooter>
          <Button fullWidth onClick={finish}>{t("go_panel")}</Button>
        </PlayFooter>
      </div>
    </main>
  );
}
