import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AltArrowLeftIcon } from "@solar-icons/react-native/linear/alt-arrow-left";
import { AltArrowRightIcon } from "@solar-icons/react-native/linear/alt-arrow-right";
import { MenuDotsIcon } from "@solar-icons/react-native/bold/menu-dots";
import { AddIcon } from "@solar-icons/react-native/linear/add";
import { ApiClientError } from "@mentor/api-client";
import type { StudyRoomDetailDto, StudyRoomSeatDto, StudyRoomTheme } from "@mentor/types";
import { CommunityAvatar } from "../../components/community/community-avatar.js";
import { FormSheet } from "../../components/panel/primitives.js";
import { RoomInviteSheet } from "../../components/session/room-sheets.js";
import { SessionStage, useStageLook } from "../../components/session/session-stage.js";
import { AppText, Button, ConfirmDialog, Skeleton, StateView } from "../../components/ui/index.js";
import { closeStudyRoom, getStudyRoom, leaveStudyRoom, updateStudyRoom } from "../../lib/community-api.js";
import { haptics } from "../../lib/haptics.js";
import { seatLabel, seatPositions, stepRoomTheme } from "../../lib/room-view.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useAppAvailability } from "../../providers/availability-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useToast } from "../../providers/toast-provider.js";

import libraryTable from "../../../../web/public/img/seans-theme/room-library-table.webp";
import cafeTable from "../../../../web/public/img/seans-theme/room-cafe-table.webp";
import homeTable from "../../../../web/public/img/seans-theme/room-home-table.webp";
import librarySeat from "../../../../web/public/img/seans-theme/room-library-seat.webp";
import cafeSeat from "../../../../web/public/img/seans-theme/room-cafe-seat.webp";
import homeSeat from "../../../../web/public/img/seans-theme/room-home-seat.webp";

const TABLE = { LIBRARY: libraryTable, CAFE: cafeTable, HOME: homeTable } as const satisfies Record<StudyRoomTheme, number>;
const SEAT = { LIBRARY: librarySeat, CAFE: cafeSeat, HOME: homeSeat } as const satisfies Record<StudyRoomTheme, number>;
const CHAIR = 64;
const SEAT_W = 84;

/** The web's room page (`room-shell`): the table scene of one room, presence polled every 30 s. */
export default function StudyRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations("sessionRoom");
  const router = useRouter();
  const { availability } = useAppAvailability();
  const room = useQuery({
    queryKey: ["study-rooms", "detail", id],
    queryFn: () => getStudyRoom(id),
    enabled: Boolean(id) && availability.studyRooms,
    refetchInterval: 30_000,
  });

  const toSession = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/study-session");
  };

  if (!availability.studyRooms || room.isError) {
    const status = room.error instanceof ApiClientError ? room.error.status : 0;
    const notFound = !availability.studyRooms || status === 404 || status === 403;
    return (
      <SessionStage phase="idle" theme={null}>
        <View style={styles.center}>
          <StateView tone={notFound ? undefined : "error"}
            title={t(notFound ? "not_found_title" : "load_failed_title")} body={t(notFound ? "not_found_body" : "load_failed_body")}
            actionLabel={t(notFound ? "back_to_session" : "arrive_retry")}
            onAction={notFound ? toSession : () => void room.refetch()} />
        </View>
      </SessionStage>
    );
  }

  if (!room.data) {
    return (
      <SessionStage phase="idle" theme={null}>
        <View accessibilityLabel={t("loading_room")} style={[styles.center, { gap: 16, alignItems: "center" }]}>
          <Skeleton width={160} height={24} />
          <Skeleton width={280} height={280} />
          <Skeleton width={240} height={52} />
        </View>
      </SessionStage>
    );
  }

  return (
    <SessionStage phase="idle" theme={room.data.theme}>
      <RoomScene room={room.data} onLeft={toSession} />
    </SessionStage>
  );
}

function RoomScene({ room, onLeft }: { room: StudyRoomDetailDto; onLeft: () => void }) {
  const t = useTranslations("sessionRoom");
  const look = useStageLook();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<"menu" | "invite" | "close" | "leave" | null>(null);
  const [busy, setBusy] = useState(false);
  const owner = room.role === "OWNER";
  const seatedHere = room.seats.some((s) => s.userId === user?.id && s.isSeated);
  const canInvite = owner && Boolean(room.inviteCode);

  const themeRequest = useRef(0);
  const changeTheme = async (delta: 1 | -1) => {
    haptics.selection();
    // Fast taps race: a late reply or rollback from an older tap must not undo a newer choice.
    const request = ++themeRequest.current;
    const theme = stepRoomTheme(room.theme, delta);
    const key = ["study-rooms", "detail", room.id];
    queryClient.setQueryData(key, { ...room, theme });
    try {
      const saved = await updateStudyRoom(room.id, { theme });
      if (request !== themeRequest.current) return;
      queryClient.setQueryData(key, saved);
      void queryClient.invalidateQueries({ queryKey: ["study-rooms", "list"] });
    } catch {
      if (request !== themeRequest.current) return;
      queryClient.setQueryData(key, room);
      toast.show(t("error_title"));
    }
  };

  const confirmExit = async () => {
    const closing = panel === "close";
    setBusy(true);
    try {
      if (closing) await closeStudyRoom(room.id);
      else await leaveStudyRoom(room.id);
      haptics.success();
      setPanel(null);
      queryClient.removeQueries({ queryKey: ["study-rooms", "detail", room.id] });
      await queryClient.invalidateQueries({ queryKey: ["study-rooms", "list"] });
      onLeft();
    } catch (err) {
      toast.show(err instanceof ApiClientError && err.body.message ? err.body.message : t("error_title"));
    } finally {
      setBusy(false);
    }
  };

  const glassButton = [styles.round, { backgroundColor: look.glass, borderColor: look.glassBorder }];
  const arrow = (delta: 1 | -1) => (
    <Pressable accessibilityRole="button" accessibilityLabel={t(delta < 0 ? "theme_prev" : "theme_next")} hitSlop={6}
      onPress={() => void changeTheme(delta)} style={styles.arrow}>
      {delta < 0 ? <AltArrowLeftIcon size={18} color={look.inkSoft} /> : <AltArrowRightIcon size={18} color={look.inkSoft} />}
    </Pressable>
  );

  return (
    <ScrollView style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16, gap: 12, flexGrow: 1 }}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("back_to_session")} onPress={onLeft} style={glassButton}>
          <AltArrowLeftIcon size={22} color={look.ink} />
        </Pressable>
        <AppText accessibilityRole="header" numberOfLines={2} style={[styles.title, { color: look.ink }]}>{room.name}</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel={t("room_menu")} onPress={() => setPanel("menu")} style={glassButton}>
          <MenuDotsIcon size={22} color={look.ink} />
        </Pressable>
      </View>

      <View style={styles.themeRow}>
        {owner ? arrow(-1) : null}
        <AppText numberOfLines={1} style={{ width: 104, textAlign: "center", color: look.ink, fontWeight: "700" }}>{t(`theme_${room.theme}`)}</AppText>
        {owner ? arrow(1) : null}
      </View>

      <Seats room={room} size={Math.min(width - 32, 420)} onInvite={canInvite ? () => setPanel("invite") : undefined} />

      <View style={{ flex: 1 }} />
      <Pressable accessibilityRole="button" onPress={() => {
        haptics.selection();
        // Seated: the running session lives in the session screen below (the timer is not
        // restored from the server), so go back to it instead of opening a fresh idle one.
        if (seatedHere) router.dismissTo("/(app)/study-session");
        else router.push({ pathname: "/(app)/study-session", params: { roomId: room.id } });
      }} style={styles.cta}>
        <AppText style={styles.ctaLabel}>{t(seatedHere ? "seated_here" : "start_here")}</AppText>
      </Pressable>

      {panel === "menu" ? (
        <FormSheet visible title={t("room_menu")} closeLabel={t("cancel")} onClose={() => setPanel(null)}>
          <View style={{ gap: 8 }}>
            {canInvite ? <Button label={t("invite_title")} variant="secondary" onPress={() => setPanel("invite")} /> : null}
            <Button label={t(owner ? "close_room" : "leave")} variant="danger" onPress={() => setPanel(owner ? "close" : "leave")} />
          </View>
        </FormSheet>
      ) : null}
      {panel === "invite" ? <RoomInviteSheet room={room} onClose={() => setPanel(null)} /> : null}
      <ConfirmDialog visible={panel === "close" || panel === "leave"}
        title={t(panel === "close" ? "confirm_close_title" : "confirm_leave_title")}
        message={t(panel === "close" ? "confirm_close_body" : "confirm_leave_body", { name: room.name })}
        confirmLabel={t(panel === "close" ? "confirm_close_action" : "confirm_leave_action")}
        cancelLabel={t("cancel")} destructive
        onCancel={() => { if (!busy) setPanel(null); }} onConfirm={() => { if (!busy) void confirmExit(); }} />
    </ScrollView>
  );
}

/**
 * The web's `room-seats` in its portrait layout: the table photo turned 90°, chairs on an
 * ellipse around it. ponytail: no arrive pulse and no image fallback (the art is bundled).
 */
function Seats({ room, size, onInvite }: { room: StudyRoomDetailDto; size: number; onInvite?: () => void }) {
  const t = useTranslations("sessionRoom");
  const look = useStageLook();
  const height = (size * 4) / 3;
  const total = Math.max(room.capacity, room.seats.length);
  const positions = seatPositions(total, { rx: 36, ry: 34, yScale: 4 / 3 });
  const table = size * 0.48;
  const text = { textShadowColor: room.theme === "HOME" ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.45)", textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } };

  return (
    <View style={{ width: size, height, alignSelf: "center" }}>
      <Image source={TABLE[room.theme]} contentFit="contain" accessible={false}
        style={{ position: "absolute", width: table, height: table, left: (size - table) / 2, top: (height - table) / 2, transform: [{ rotate: "90deg" }] }} />
      {positions.map((p, i) => {
        const seat: StudyRoomSeatDto | undefined = room.seats[i];
        const style = { position: "absolute" as const, width: SEAT_W, left: (p.leftPct / 100) * size - SEAT_W / 2, top: (p.topPct / 100) * height - CHAIR / 2 };
        if (!seat) {
          const chair = (
            <View style={[styles.chair, { opacity: 0.55 }]}>
              <Image source={SEAT[room.theme]} style={StyleSheet.absoluteFill} contentFit="contain" accessible={false} />
              {onInvite ? <AddIcon size={20} color={look.ink} /> : null}
            </View>
          );
          return onInvite ? (
            <Pressable key={`empty-${i}`} accessibilityRole="button" accessibilityLabel={t("invite_seat")} onPress={onInvite} style={[style, styles.seat]}>
              {chair}
              <AppText variant="caption" style={[{ color: look.inkSoft, fontWeight: "700" }, text]}>{t("invite_seat")}</AppText>
            </Pressable>
          ) : (
            <View key={`empty-${i}`} accessible accessibilityLabel={t("seat_empty")} style={[style, styles.seat]}>{chair}</View>
          );
        }
        const line = seat.isSeated
          ? seat.subject ? t("seat_live_line", { subject: seat.subject, minutes: seat.seatedMinutes ?? 0 }) : t("seat_focusing_short", { minutes: seat.seatedMinutes ?? 0 })
          : t("seat_idle");
        return (
          <View key={seat.userId} accessible accessibilityLabel={`${seat.displayName}, ${line}`} style={[style, styles.seat]}>
            <View style={[styles.chair, { opacity: seat.isSeated ? 1 : 0.55 }]}>
              <Image source={SEAT[room.theme]} style={StyleSheet.absoluteFill} contentFit="contain" accessible={false} />
              <View style={seat.isSeated ? [styles.ring, { borderColor: look.live }] : undefined}>
                <CommunityAvatar name={seat.displayName} avatarUrl={seat.avatarUrl} size={34} />
              </View>
            </View>
            <AppText numberOfLines={1} variant="caption" style={[{ color: look.ink, fontWeight: "800", opacity: seat.isSeated ? 1 : 0.7 }, text]}>
              {seatLabel(seat.displayName)}
            </AppText>
            <View style={styles.lineRow}>
              {seat.isSeated ? <View style={[styles.dot, { backgroundColor: look.live }]} /> : null}
              <AppText numberOfLines={2} style={[styles.line, { color: seat.isSeated ? look.ink : look.inkSoft }, text]}>{line}</AppText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", padding: 24 },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontWeight: "900", fontSize: 20 },
  themeRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  arrow: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  seat: { alignItems: "center", gap: 2 },
  chair: { width: CHAIR, height: CHAIR, alignItems: "center", justifyContent: "center" },
  ring: { borderWidth: 2, borderRadius: 20, padding: 1 },
  lineRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 4, width: SEAT_W },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  line: { fontSize: 11, lineHeight: 14, fontWeight: "700", textAlign: "center", flexShrink: 1 },
  cta: { minHeight: 56, borderRadius: 28, backgroundColor: "#55ACEE", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  ctaLabel: { color: "#0F2233", fontWeight: "900", fontSize: 17 },
});
