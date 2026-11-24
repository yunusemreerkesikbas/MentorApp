import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MentorshipStackBar } from "../mentorship/coach-identity-badges.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button } from "../ui/index.js";

export function NotebookFrame({ title, onBack, children, scroll = true }: { title: string; onBack: () => void; children: ReactNode; scroll?: boolean }) {
  const { palette, space } = useThemeTokens();
  const insets = useSafeAreaInsets();
  return <View style={{ flex: 1, backgroundColor: palette.bg }}>
    <MentorshipStackBar title={title} onBack={onBack} />
    <ScrollView keyboardShouldPersistTaps="handled" scrollEnabled={scroll} contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.lg }}>
      {children}
    </ScrollView>
  </View>;
}
export function NotebookError({ retry }: { retry: () => void }) {
  const t = useTranslations("notebooks");
  return <><AppText tone="danger">{t("error")}</AppText><Button label={t("retry")} onPress={retry} /></>;
}
