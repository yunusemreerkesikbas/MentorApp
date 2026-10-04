"use client";

import Image from "next/image";
import { useState } from "react";
import { Compass } from "lucide-react";
import { useTranslations } from "next-intl";
import { ApiClientError } from "@mentor/api-client";
import { CAREER_GROUPS, type CareerGroup, type ExamType } from "@mentor/types";
import { Button } from "@mentor/ui";
import { PlayGridCard, PlayIconWell } from "@/components/onboarding-play/play-choice";
import { PlayFooter } from "@/components/onboarding-play/play-footer";
import { PlayTitle } from "@/components/onboarding-play/play-heading";
import { careerPuhu3d } from "@/lib/onboarding-assets";
import { OnboardingStepLayout } from "../onboarding-step-layout";
import { saveOnboardingVision } from "./onboarding-vision";
import type { MotivationKey } from "./why-step";

type FieldChoice = CareerGroup | "none";

/**
 * Which field, on the soft-3D career Puhus. Leaving this step (Devam or Şimdilik geç) writes the
 * why + field answers to the goal board in one go; with neither answered nothing is written.
 */
export function FieldStep({
  progress,
  examType,
  motivation,
  initial,
  replaceOwnVision,
  onBack,
  onSaved,
}: {
  progress: { done: number; total: number } | null;
  examType: ExamType | null;
  motivation: MotivationKey | null;
  initial: CareerGroup | null;
  /** This session already wrote the board, so going back and changing the answer may rewrite it. */
  replaceOwnVision: boolean;
  onBack: () => void;
  onSaved: (careerGroup: CareerGroup | null, wroteVision: boolean) => void;
}) {
  const t = useTranslations("onboarding.field");
  const why = useTranslations("onboarding.why");
  const career = useTranslations("vision.career");
  const [selected, setSelected] = useState<FieldChoice | null>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function leave(choice: FieldChoice | null) {
    if (saving) return;
    const careerGroup = choice && choice !== "none" ? choice : null;
    const motivationText = motivation && motivation !== "other" ? why(`options.${motivation}`) : null;
    if (!careerGroup && !motivationText) return onSaved(null, false);
    setSaving(true);
    setError(null);
    try {
      const wrote = await saveOnboardingVision(
        {
          goalTitle: careerGroup
            ? t("goal_title", { field: career(`group.${careerGroup}`) })
            : t("goal_title_exam", { exam: examType ?? "" }),
          careerGroup,
          motivation: motivationText,
        },
        replaceOwnVision,
      );
      onSaved(careerGroup, wrote);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.body.message : t("save_error"));
    } finally {
      setSaving(false);
    }
  }

  const artSize = "size-[3.25rem] lg:size-[5.5rem]";

  return (
    <OnboardingStepLayout
      wide
      progress={progress}
      onBack={onBack}
      skipLabel={t("skip")}
      onSkip={() => void leave(null)}
      heading={<PlayTitle title={t("title")} sub={t("subtitle")} center />}
      footer={
        <PlayFooter divider error={error}>
          <Button fullWidth onClick={() => void leave(selected)} busy={saving} disabled={!selected} className="lg:ml-auto lg:w-[12.5rem]">
            {t("continue")}
          </Button>
        </PlayFooter>
      }
    >
      <div role="radiogroup" aria-label={t("title")} className="grid grid-cols-3 gap-3 lg:grid-cols-6 lg:gap-4">
        {CAREER_GROUPS.map((group, index) => (
          <PlayGridCard
            key={group}
            index={index}
            compact
            label={career(`group.${group}`)}
            art={
              <Image
                src={careerPuhu3d(group)}
                alt=""
                width={88}
                height={88}
                className={`${artSize} object-contain mix-blend-multiply dark:rounded-xl dark:mix-blend-normal`}
              />
            }
            selected={selected === group}
            disabled={saving}
            onSelect={() => setSelected(group)}
          />
        ))}
        <PlayGridCard
          index={CAREER_GROUPS.length}
          compact
          label={career("none")}
          art={
            <PlayIconWell well="peri" className={artSize}>
              <Compass size={26} />
            </PlayIconWell>
          }
          selected={selected === "none"}
          disabled={saving}
          onSelect={() => setSelected("none")}
        />
      </div>
    </OnboardingStepLayout>
  );
}
