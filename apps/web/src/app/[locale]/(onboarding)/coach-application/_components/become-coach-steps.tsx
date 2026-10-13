"use client";

import { Check, Minus, Plus } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import { PlayFooter } from "@/components/onboarding-play/play-footer";
import { PlayTitle, PuhuBubble } from "@/components/onboarding-play/play-heading";
import { PuhuImage } from "@/components/puhu-image";
import { OnboardingStepLayout } from "../../_components/onboarding-step-layout";

type Progress = { done: number; total: number } | null;

const PLAY_CARD =
  "rounded-[var(--play-radius)] border-2 border-[var(--play-line)] bg-[var(--color-surface)]";

/**
 * A reason there is no form to show, said before anybody fills one in: intake shut, a standing an
 * admin set, a live link to a coach, SMS switched off. One sentence, one way out.
 */
export function GateNotice({
  title,
  body,
  note,
  puhu = false,
  onBack,
  children,
}: {
  title: string;
  body: string;
  /** The admin's words, shown as written. One-way: a decision, not a conversation. */
  note?: string | null;
  puhu?: boolean;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <OnboardingStepLayout
      progress={null}
      onBack={onBack}
      heading={
        <div className="flex flex-col items-center gap-5 pt-6 text-center">
          {puhu ? <PuhuImage variant="encouraging" size={120} /> : null}
          <PlayTitle title={title} sub={body} />
        </div>
      }
      footer={<PlayFooter>{children}</PlayFooter>}
    >
      {note ? (
        <p className={`${PLAY_CARD} px-4 py-3 text-sm font-semibold text-[var(--color-body)]`}>
          {note}
        </p>
      ) : null}
    </OnboardingStepLayout>
  );
}

/**
 * What the switch costs, before anything is asked for. Becoming a coach closes the student's own
 * screens on this account and nobody can undo that themselves, so it is the first thing said.
 */
export function ChangeStep({
  progress,
  onBack,
  onContinue,
}: {
  progress: Progress;
  onBack: () => void;
  onContinue: () => void;
}) {
  const t = useTranslations("mentorship");
  const rows: { key: "closes" | "opens" | "stays"; icon: ReactElement }[] = [
    { key: "closes", icon: <Minus size={20} strokeWidth={1.75} className="text-[var(--color-secondary)]" aria-hidden /> },
    { key: "opens", icon: <Plus size={20} strokeWidth={1.75} className="text-[var(--play-selected-ink)]" aria-hidden /> },
    { key: "stays", icon: <Check size={20} strokeWidth={1.75} className="text-[var(--color-success)]" aria-hidden /> },
  ];

  return (
    <OnboardingStepLayout
      progress={progress}
      onBack={onBack}
      heading={<PuhuBubble title={t("become_change_title")} sub={t("become_change_sub")} />}
      footer={
        <PlayFooter>
          <Button fullWidth onClick={onContinue}>
            {t("become_continue")}
          </Button>
        </PlayFooter>
      }
    >
      <dl className={`${PLAY_CARD} flex flex-col divide-y-2 divide-[var(--play-line)]`}>
        {rows.map(({ key, icon }) => (
          <div key={key} className="flex items-start gap-3 px-4 py-3.5">
            <span className="flex size-6 shrink-0 items-center justify-center">{icon}</span>
            <div className="min-w-0">
              <dt className="text-base font-extrabold leading-snug text-[var(--color-main)]">
                {t(`become_${key}_title`)}
              </dt>
              <dd className="mt-0.5 text-sm font-medium leading-relaxed text-[var(--color-body)]">
                {t(`become_${key}_body`)}
              </dd>
            </div>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm font-semibold leading-relaxed text-[var(--color-secondary)]">
        {t("become_change_oneway")}
      </p>
    </OnboardingStepLayout>
  );
}
