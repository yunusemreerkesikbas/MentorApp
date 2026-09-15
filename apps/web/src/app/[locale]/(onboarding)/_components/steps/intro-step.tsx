"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { StreamingText } from "@mentor/ui";
import { PlayButton } from "@/components/onboarding-play/play-button";
import { PlayFooter } from "@/components/onboarding-play/play-footer";
import { PUHU_MOTION_FRAMES } from "@/lib/onboarding-assets";
import { OnboardingStepLayout } from "../onboarding-step-layout";

export function IntroStep({ displayName, onContinue }: { displayName: string; onContinue: () => void }) {
  const t = useTranslations("onboarding.welcome");
  const firstName = displayName.trim().split(/\s+/)[0] || displayName;
  const title = t("title", { name: firstName });

  return (
    <OnboardingStepLayout
      progress={null}
      footer={
        <PlayFooter>
          <PlayButton onClick={onContinue}>{t("continue")}</PlayButton>
        </PlayFooter>
      }
    >
      <div className="flex flex-col items-center gap-5 pt-10 text-center">
        <div
          aria-live="polite"
          className="relative max-w-xs rounded-[var(--play-radius)] border-2 border-[var(--play-line)] bg-[var(--color-surface)] px-5 py-4"
        >
          <h1 className="text-balance text-xl font-extrabold leading-snug text-[var(--color-main)]">
            <StreamingText key={title} text={title} />
          </h1>
          <p className="mt-1.5 text-pretty text-sm font-medium leading-relaxed text-[var(--color-secondary)]">{t("subtitle")}</p>
          <span
            aria-hidden
            className="absolute -bottom-[9px] left-1/2 size-3.5 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-[var(--play-line)] bg-[var(--color-surface)]"
          />
        </div>
        <Image src={PUHU_MOTION_FRAMES.wave} alt="" width={240} height={240} priority className="size-60 object-contain" />
      </div>
    </OnboardingStepLayout>
  );
}
