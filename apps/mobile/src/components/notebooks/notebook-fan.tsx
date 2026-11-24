import { useState } from "react";
import { Pressable, View } from "react-native";
import type { NotebookEntryDto } from "@mentor/types";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button } from "../ui/index.js";

/** Fan the next three due cards. Focus is independent of the server's due order. */
export function NotebookFan({ entries, open }: { entries: NotebookEntryDto[]; open: (id: string) => void }) {
  const t = useTranslations("notebooks");
  const a = useTranslations("analysis");
  const { palette, radii, space } = useThemeTokens();
  const [index, setIndex] = useState(0);
  const cards = entries.slice(0, 3);
  const selected = cards[index % cards.length];
  if (!selected) return null;
  return <View style={{ gap: space.md }}>
    <View style={{ alignItems: "center", justifyContent: "center", minHeight: 178 }}>
      {cards.map((entry, i) => <Pressable key={entry.id} accessibilityRole="button" onPress={() => open(entry.id)}
        style={{ position: "absolute", minHeight: 144, width: "71%", padding: space.md, justifyContent: "center",
          backgroundColor: palette.surface, borderRadius: radii.inner, borderColor: palette.border, borderWidth: 1,
          zIndex: selected.id === entry.id ? 4 : i, transform: [{ translateX: (i - (cards.length-1)/2) * 24 }, { rotate: ((i - (cards.length-1)/2) * 6) + "deg" }] }}>
        <AppText variant="caption" tone="secondary">{entry.topicName ?? entry.subjectName ?? a(`error_${entry.errorType}`)}</AppText>
        {entry.note && <AppText numberOfLines={3}>{entry.note}</AppText>}
      </Pressable>)}
    </View>
    <Button label={t("review")} onPress={() => open(selected.id)} />
    {cards.length > 1 && <Button label={t("next")} variant="secondary" onPress={() => setIndex((index + 1) % cards.length)} />}
  </View>;
}
