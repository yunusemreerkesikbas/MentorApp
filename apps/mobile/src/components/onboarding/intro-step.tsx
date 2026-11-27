import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { firstName } from "@mentor/core";
import { haptics } from "../../lib/haptics.js";
import { PUHU_MOTION_FRAMES } from "../../lib/onboarding-assets.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { Button } from "../ui/index.js";
import { PlayStepLayout, PlayTitle } from "../onboarding-play/index.js";

/** The web's `IntroStep`: Puhu waves hello above a centred greeting; no progress yet. */
export function IntroStep({ displayName, onContinue }: { displayName: string; onContinue: () => void }) {
  const t = useTranslations("play");
  const tDashboard = useTranslations("dashboard");
  const { space } = useThemeTokens();
  const name = firstName(displayName) || tDashboard("default_name");
  return (
    <PlayStepLayout
      progress={null}
      heading={<PlayTitle center title={t("welcome_title", { name })} sub={t("welcome_subtitle")} />}
      footer={
        <Button
          label={t("welcome_continue")}
          onPress={() => {
            haptics.selection();
            onContinue();
          }}
        />
      }
    >
      <View style={[styles.art, { marginTop: space.lg }]}>
        <Image source={PUHU_MOTION_FRAMES.wave} style={styles.puhu} contentFit="contain" accessible={false} />
      </View>
    </PlayStepLayout>
  );
}

const styles = StyleSheet.create({
  art: { alignItems: "center" },
  puhu: { width: 240, height: 240 },
});
