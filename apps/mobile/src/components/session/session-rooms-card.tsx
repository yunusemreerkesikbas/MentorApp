import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AddIcon } from "@solar-icons/react-native/linear/add";
import { AltArrowRightIcon } from "@solar-icons/react-native/linear/alt-arrow-right";
import type { StudyRoomDto } from "@mentor/types";
import { art } from "../../lib/art.js";
import { listStudyRooms } from "../../lib/community-api.js";
import { haptics } from "../../lib/haptics.js";
import { useAppAvailability } from "../../providers/availability-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { AppText, Button, Skeleton } from "../ui/index.js";
import { RoomCreateSheet, RoomJoinSheet } from "./room-sheets.js";
import { ROOM_BACKDROP, StageCard, useStageLook } from "./session-stage.js";

/**
 * The web's `session-room-list` ("Masaların"): the rooms you sit at, create and join. Shown on
 * the session screen and, wrapped in a plain stage, in Topluluk → Masalar. Hidden on error, like the web.
 */
export function SessionRoomsCard() {
  const t = useTranslations("sessionRoom");
  const look = useStageLook();
  const router = useRouter();
  const { availability } = useAppAvailability();
  const [sheet, setSheet] = useState<"create" | "join" | null>(null);
  const rooms = useQuery({
    queryKey: ["study-rooms", "list"],
    queryFn: listStudyRooms,
    enabled: availability.studyRooms,
    refetchInterval: 30_000,
  });

  // A failed refetch keeps the cached list (and an open sheet); only a first-load failure hides the card.
  if (!availability.studyRooms || (rooms.isError && !rooms.data)) return null;

  const open = (id: string) => {
    setSheet(null);
    router.push({ pathname: "/(app)/study-room", params: { id } });
  };
  const list = rooms.data ?? [];
  const link = { color: look.scenic ? look.ink : look.selectedInk, fontWeight: "800" } as const;

  return (
    <StageCard title={t("section_title")} action={list.length > 0 ? (
      <Pressable accessibilityRole="button" accessibilityLabel={t("create_action")} hitSlop={8}
        onPress={() => { haptics.selection(); setSheet("create"); }}
        style={[styles.plus, { backgroundColor: look.glass, borderColor: look.glassBorder }]}>
        <AddIcon size={20} color={look.ink} />
      </Pressable>
    ) : undefined}>
      {rooms.isPending ? (
        <View style={{ gap: 10 }}>
          <Skeleton width="100%" height={52} />
          <Skeleton width="100%" height={52} />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.empty}>
          <Image source={art.puhuEncouraging} style={styles.puhu} contentFit="contain" accessible={false} />
          <AppText style={{ color: look.inkSoft, fontWeight: "600", textAlign: "center" }}>{t("empty")}</AppText>
          <Button label={t("create_action")} onPress={() => setSheet("create")} />
        </View>
      ) : (
        <View style={{ gap: 4 }}>
          {list.map((room) => <RoomRow key={room.id} room={room} onPress={() => open(room.id)} />)}
        </View>
      )}
      {rooms.isPending ? null : (
        <Pressable accessibilityRole="button" onPress={() => setSheet("join")} hitSlop={8} style={{ alignSelf: "center" }}>
          <AppText style={link}>{t("join_action")}</AppText>
        </Pressable>
      )}
      {sheet === "create" ? <RoomCreateSheet onClose={() => setSheet(null)} onCreated={(room) => open(room.id)} /> : null}
      {sheet === "join" ? <RoomJoinSheet onClose={() => setSheet(null)} onJoined={open} /> : null}
    </StageCard>
  );
}

function RoomRow({ room, onPress }: { room: StudyRoomDto; onPress: () => void }) {
  const t = useTranslations("sessionRoom");
  const look = useStageLook();
  const meta = t("row_meta", { theme: t(`theme_${room.theme}`), filled: room.memberCount, capacity: room.capacity });
  return (
    <Pressable accessibilityRole="button" onPress={() => { haptics.selection(); onPress(); }} style={styles.row}>
      <Image source={ROOM_BACKDROP[room.theme]} contentFit="cover" accessible={false}
        style={[styles.swatch, { opacity: room.isActive ? 1 : 0.5 }]} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText style={{ color: look.ink, fontWeight: "800" }}>{room.name}</AppText>
        <AppText variant="caption" style={{ color: look.inkSoft, fontWeight: "600" }}>
          {room.isActive ? meta : `${meta} · ${t("dormant_short")}`}
        </AppText>
        {room.activeCount > 0 ? (
          <View style={styles.live}>
            <View style={[styles.dot, { backgroundColor: look.live }]} />
            <AppText variant="caption" style={{ color: look.inkSoft, fontWeight: "700" }}>{t("active_now", { count: room.activeCount })}</AppText>
          </View>
        ) : null}
      </View>
      <AltArrowRightIcon size={18} color={look.inkSoft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plus: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", gap: 12 },
  puhu: { width: 96, height: 96 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 6 },
  swatch: { width: 44, height: 44, borderRadius: 12 },
  live: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
