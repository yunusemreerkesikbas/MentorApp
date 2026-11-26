import { useRef, useState, type ComponentRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { useQuery } from "@tanstack/react-query";
import type { StudyRoomTheme } from "@mentor/types";
import { art } from "../../lib/art.js";
import { listStudySessions } from "../../lib/coaching-api.js";
import { historyDateRange, shareSessionOrdinal } from "../../lib/session-view.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useToast } from "../../providers/toast-provider.js";
import { FormSheet } from "../panel/primitives.js";
import { AppText, Button } from "../ui/index.js";
import { Stars } from "./session-stars.js";
import { ROOM_BACKDROP } from "./session-stage.js";

const HAND = "Caveat_700Bold";

/** The web card's fixed room palettes (`session-share-card.ts`): a card that leaves the app ignores the theme. */
const ROOM = {
  LIBRARY: { from: "#3a2e23", ink: "#f7f0e4", inkSoft: "#cdb99f", focal: "16%" },
  CAFE: { from: "#2a1f1a", ink: "#f5ede6", inkSoft: "#c2ac9c", focal: "88%" },
  HOME: { from: "#f3eff9", ink: "#2a2438", inkSoft: "#665c7c", focal: "10%" },
} as const;

/**
 * The web's share sheet without the develop animation (ponytail: the static last frame is the
 * PNG anyway). A 9:16 story card: date, the taped room polaroid, the caption, stars and Puhu.
 */
export function SessionShareSheet({
  sessionId,
  minutes,
  subject,
  stars,
  theme,
  endedAt,
  onClose,
}: {
  sessionId: string | null;
  minutes: number;
  subject: string | null;
  stars: number;
  theme: StudyRoomTheme;
  endedAt: Date;
  onClose: () => void;
}) {
  const t = useTranslations("session");
  const { locale } = useLocale();
  const toast = useToast();
  const card = useRef<ComponentRef<typeof View> | null>(null);
  const [loaded, setLoaded] = useState(0);
  const [sharing, setSharing] = useState(false);
  const today = useQuery({
    queryKey: ["study-sessions", "today"],
    queryFn: async () => (await listStudySessions(1, 20, historyDateRange("today"))).items,
  });

  const look = ROOM[theme];
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const duration = hours === 0 ? t("share_card_m", { minutes })
    : rest === 0 ? t("share_card_h", { hours })
    : t("share_card_hm", { hours, minutes: rest });
  const caption = subject ? t("share_card_subject", { duration, subject }) : t("share_card_focus", { duration });
  const nth = shareSessionOrdinal(today.data ?? [], sessionId);
  const place = t(`share_card_place_line`, {
    nth: nth <= 1 ? t("share_card_first") : t("share_card_nth", { count: nth }),
    place: t(`share_card_place_${theme}`),
  });
  const date = t("share_card_date", {
    day: endedAt.toLocaleDateString(locale, { day: "numeric", month: "long" }),
    weekday: endedAt.toLocaleDateString(locale, { weekday: "long" }),
  });
  const ready = loaded >= 2 && !today.isPending;

  const share = async () => {
    if (!card.current || !ready || sharing) return;
    setSharing(true);
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error("unavailable");
      const uri = await captureRef(card.current, { format: "png", result: "tmpfile", width: 1080, height: 1920 });
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: t("share_text", { minutes }) });
    } catch {
      toast.show(t("share_error_title"));
    } finally {
      setSharing(false);
    }
  };

  return (
    <FormSheet visible title={t("share_sheet_title")} closeLabel={t("share_close")} onClose={onClose} closeDisabled={sharing}
      footer={<Button label={t("share_action")} loading={sharing} disabled={!ready} onPress={() => void share()} />}>
      <View ref={card} collapsable={false} accessible accessibilityRole="image"
        accessibilityLabel={t("share_card_label", { caption, place })}
        style={[styles.card, { backgroundColor: look.from }]}>
        <Text style={[styles.date, { color: look.ink }]}>{date}</Text>
        <View style={styles.print}>
          <View style={styles.tape} />
          <Image source={ROOM_BACKDROP[theme]} style={styles.photo} contentFit="cover"
            contentPosition={{ left: look.focal }} onLoad={() => setLoaded((n) => n + 1)} accessible={false} />
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.caption}>{caption}</Text>
          <Text numberOfLines={2} style={styles.place}>{place}</Text>
        </View>
        <Stars filled={stars} size={0.7} />
        <Image source={art.puhuHappy} style={styles.puhu} contentFit="contain" onLoad={() => setLoaded((n) => n + 1)} accessible={false} />
        <AppText style={[styles.brand, { color: look.inkSoft }]}>PuhuKoç</AppText>
      </View>
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  // 9:16 so the PNG is a phone story frame.
  card: { width: "100%", aspectRatio: 9 / 16, borderRadius: 16, overflow: "hidden", alignItems: "center", paddingTop: 28, gap: 14 },
  date: { fontFamily: HAND, fontSize: 26, lineHeight: 32, paddingHorizontal: 4 },
  print: { width: "72%", backgroundColor: "#ffffff", padding: 10, paddingBottom: 14, borderRadius: 3, transform: [{ rotate: "-2.5deg" }],
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  tape: { position: "absolute", top: -10, alignSelf: "center", width: 72, height: 20, backgroundColor: "rgba(236, 214, 170, 0.78)", zIndex: 1, transform: [{ rotate: "3deg" }] },
  photo: { width: "100%", aspectRatio: 1, backgroundColor: "#d9dad4" },
  caption: { fontFamily: HAND, fontSize: 26, lineHeight: 32, color: "#26304a", textAlign: "center", marginTop: 8, paddingHorizontal: 4 },
  place: { fontFamily: HAND, fontSize: 18, lineHeight: 22, color: "#6f6656", textAlign: "center", paddingHorizontal: 4 },
  puhu: { position: "absolute", right: 8, bottom: 30, width: "27%", aspectRatio: 1, transform: [{ rotate: "8deg" }] },
  brand: { position: "absolute", bottom: 14, left: 16, fontWeight: "900", fontSize: 14 },
});
