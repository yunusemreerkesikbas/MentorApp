"use client";

import { useState } from "react";
import { BriefcaseBusiness, Ellipsis, Flag, House, ShieldCheck, Sprout, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@mentor/ui";
import { PlayGridCard, PlayIconWell, type PlayWell } from "@/components/onboarding-play/play-choice";
import { PlayFooter } from "@/components/onboarding-play/play-footer";
import { PuhuBubble } from "@/components/onboarding-play/play-heading";
import { OnboardingStepLayout } from "../onboarding-step-layout";

export const MOTIVATIONS = [
  { key: "dream_job", icon: BriefcaseBusiness, well: "blue" },
  { key: "secure_future", icon: ShieldCheck, well: "peri" },
  { key: "family", icon: House, well: "coral" },
  { key: "prove_myself", icon: Flag, well: "violet" },
  { key: "fresh_start", icon: Sprout, well: "pink" },
  { key: "other", icon: Ellipsis, well: "blue" },
] as const satisfies readonly { key: string; icon: LucideIcon; well: PlayWell }[];

export type MotivationKey = (typeof MOTIVATIONS)[number]["key"];

/** Nothing is saved here: the answer rides along with the field step's single goal-board write. */
export function WhyStep({
  progress,
  initial,
  onBack,
  onContinue,
}: {
  progress: { done: number; total: number } | null;
  initial: MotivationKey | null;
  onBack: () => void;
  onContinue: (motivation: MotivationKey | null) => void;
}) {
  const t = useTranslations("onboarding.why");
  const [selected, setSelected] = useState<MotivationKey | null>(initial);

  return (
    <OnboardingStepLayout
      progress={progress}
      onBack={onBack}
      skipLabel={t("skip")}
      onSkip={() => onContinue(null)}
      // Before an answer Puhu says why it asks; after one, it answers back (Duolingo's reaction beat).
      heading={<PuhuBubble title={t("title")} sub={selected ? t(`reactions.${selected}`) : t("subtitle")} />}
      footer={
        <PlayFooter>
          <Button fullWidth disabled={!selected} onClick={() => onContinue(selected)}>
            {t("continue")}
          </Button>
        </PlayFooter>
      }
    >
      <div role="radiogroup" aria-label={t("title")} className="grid grid-cols-2 gap-3">
        {MOTIVATIONS.map(({ key, icon: Icon, well }, index) => (
          <PlayGridCard
            key={key}
            index={index}
            label={t(`options.${key}`)}
            art={
              <PlayIconWell well={well} className="size-12">
                <Icon size={24} />
              </PlayIconWell>
            }
            selected={selected === key}
            onSelect={() => setSelected(key)}
          />
        ))}
      </div>
    </OnboardingStepLayout>
  );
}
