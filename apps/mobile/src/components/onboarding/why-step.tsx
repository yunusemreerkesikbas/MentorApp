import { useState } from "react";
import { View } from "react-native";
import { CaseIcon } from "@solar-icons/react-native/linear/case";
import { FlagIcon } from "@solar-icons/react-native/linear/flag";
import { Home2Icon } from "@solar-icons/react-native/linear/home-2";
import { LeafIcon } from "@solar-icons/react-native/linear/leaf";
import { MenuDotsIcon } from "@solar-icons/react-native/linear/menu-dots";
import { ShieldCheckIcon } from "@solar-icons/react-native/linear/shield-check";
import type { OnboardingMotivationKey } from "@mentor/core";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { Button } from "../ui/index.js";
import { PlayGridCard, PlayIconWell, PlayStepLayout, PuhuBubble, type PlayWell } from "../onboarding-play/index.js";
import { gridRows } from "../../lib/grid-rows.js";

const MOTIVATIONS: readonly { key: OnboardingMotivationKey; Icon: typeof CaseIcon; well: PlayWell }[] = [
  { key: "dream_job", Icon: CaseIcon, well: "blue" },
  { key: "secure_future", Icon: ShieldCheckIcon, well: "peri" },
  { key: "family", Icon: Home2Icon, well: "coral" },
  { key: "prove_myself", Icon: FlagIcon, well: "violet" },
  { key: "fresh_start", Icon: LeafIcon, well: "pink" },
  { key: "other", Icon: MenuDotsIcon, well: "blue" },
];

/** The web's `WhyStep`. Nothing is saved here; the answer rides along with the field step's write. */
export function WhyStep({
  progress, initial, onBack, onContinue,
}: {
  progress: { done: number; total: number } | null;
  initial: OnboardingMotivationKey | null;
  onBack: () => void;
  onContinue: (motivation: OnboardingMotivationKey | null) => void;
}) {
  const t = useTranslations("play");
  const { palette, space } = useThemeTokens();
  const [selected, setSelected] = useState<OnboardingMotivationKey | null>(initial);

  return (
    <PlayStepLayout
      progress={progress}
      onBack={onBack}
      skipLabel={t("why_skip")}
      onSkip={() => onContinue(null)}
      // Before an answer Puhu says why it asks; after one, it answers back.
      heading={<PuhuBubble title={t("why_title")} sub={selected ? t(`why_reactions_${selected}`) : t("why_subtitle")} />}
      footer={
        <Button
          label={t("why_continue")}
          disabled={!selected}
          onPress={() => {
            haptics.selection();
            onContinue(selected);
          }}
        />
      }
    >
      <View accessibilityRole="radiogroup" style={{ gap: space.md }}>
        {gridRows(MOTIVATIONS, 2).map((row) => (
          <View key={row[0]!.key} style={{ flexDirection: "row", gap: space.md }}>
            {row.map((item, index) => item ? (
              <PlayGridCard
                key={item.key}
                label={t(`why_options_${item.key}`)}
                art={<PlayIconWell well={item.well} size={48}><item.Icon size={24} color={palette.main} /></PlayIconWell>}
                selected={selected === item.key}
                onSelect={() => setSelected(item.key)}
              />
            ) : <View key={`pad-${index}`} style={{ flex: 1 }} />)}
          </View>
        ))}
      </View>
    </PlayStepLayout>
  );
}
