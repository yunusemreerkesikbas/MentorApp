import { Image } from "expo-image";
import { StyleSheet } from "react-native";
import { art } from "../../lib/art.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { FormSheet } from "../panel/primitives.js";
import { AppText } from "../ui/text.js";
import { recapPuhuNote } from "./recap-flow.js";

export function RecapNoteSheet({ closingMessage, narration, onClose }: {
  closingMessage: string;
  narration?: string;
  onClose: () => void;
}) {
  const t = useTranslations("recap");
  const note = recapPuhuNote(closingMessage, narration);
  return (
    <FormSheet
      visible
      title={t(note.personalized ? "puhu_sheet_ai_title" : "puhu_sheet_title")}
      closeLabel={t("puhu_sheet_close")}
      onClose={onClose}
    >
      <Image source={art.puhuEncouraging} contentFit="contain" style={styles.puhu} />
      <AppText tone="secondary" style={styles.note}>{note.text}</AppText>
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  puhu: { width: 108, height: 108, alignSelf: "center" },
  note: { fontSize: 16, lineHeight: 25, fontWeight: "700", textAlign: "center" },
});
