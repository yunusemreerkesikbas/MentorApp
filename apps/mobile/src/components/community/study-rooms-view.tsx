import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STUDY_ROOM_CAPACITIES, STUDY_ROOM_THEMES } from "@mentor/core";
import type { StudyRoomDto, StudyRoomTheme } from "@mentor/types";
import {
  closeStudyRoom,
  createStudyRoom,
  getStudyRoom,
  joinStudyRoom,
  leaveStudyRoom,
  mapStudyRoomJoinError,
  rotateStudyRoomCode,
} from "../../lib/community-api.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Card, Chip, TextField } from "../ui/index.js";

export interface StudyRoomsViewProps {
  rooms: StudyRoomDto[];
}

export function StudyRoomsView({ rooms }: StudyRoomsViewProps) {
  const t = useTranslations("community");
  const { palette, radii, space } = useThemeTokens();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("");
  const [theme, setTheme] = useState<StudyRoomTheme>("LIBRARY");
  const [capacity, setCapacity] = useState<number>(6);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(
    rooms[0]?.id ?? null,
  );

  const roomDetailQuery = useQuery({
    queryKey: ["study-room", selectedRoomId],
    queryFn: () => getStudyRoom(selectedRoomId!),
    enabled: Boolean(selectedRoomId),
  });

  const joinMutation = useMutation({
    mutationFn: () => joinStudyRoom(joinCode),
    onSuccess: (joined) => {
      void haptics.success();
      setJoinCode("");
      setJoinError(null);
      setSelectedRoomId(joined.id);
      void queryClient.invalidateQueries({ queryKey: ["study-rooms"] });
    },
    onError: (err) => {
      void haptics.error();
      const kind = mapStudyRoomJoinError(err);
      setJoinError(t(`join_err_${kind}` as "join_err_error"));
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createStudyRoom({ name: roomName.trim(), theme, capacity }),
    onSuccess: (created) => {
      void haptics.success();
      setRoomName("");
      setSelectedRoomId(created.id);
      void queryClient.invalidateQueries({ queryKey: ["study-rooms"] });
    },
  });

  const rotateMutation = useMutation({
    mutationFn: (id: string) => rotateStudyRoomCode(id),
    onSuccess: () => {
      void haptics.selection();
      void queryClient.invalidateQueries({
        queryKey: ["study-room", selectedRoomId],
      });
    },
  });

  const leaveOrCloseMutation = useMutation({
    mutationFn: async (room: StudyRoomDto) => {
      if (room.role === "OWNER") {
        await closeStudyRoom(room.id);
      } else {
        await leaveStudyRoom(room.id);
      }
    },
    onSuccess: () => {
      setSelectedRoomId(null);
      void queryClient.invalidateQueries({ queryKey: ["study-rooms"] });
    },
  });

  const detail = roomDetailQuery.data;

  return (
    <View style={{ gap: space.md }}>
      <Card style={{ gap: space.sm }}>
        <TextField
          label={t("join_code_label")}
          value={joinCode}
          onChangeText={(val) => {
            setJoinCode(val);
            setJoinError(null);
          }}
          placeholder={t("join_code_placeholder")}
          autoCapitalize="characters"
        />
        {joinError ? (
          <AppText variant="caption" tone="danger">
            {joinError}
          </AppText>
        ) : null}
        <Button
          label={t("join_room_cta")}
          variant="secondary"
          disabled={!joinCode.trim()}
          loading={joinMutation.isPending}
          onPress={() => joinMutation.mutate()}
        />
      </Card>

      <Card style={{ gap: space.sm }}>
        <AppText variant="sectionHeading">{t("my_rooms_title")}</AppText>
        {rooms.length === 0 ? (
          <AppText variant="body" tone="secondary">
            {t("rooms_empty")}
          </AppText>
        ) : (
          <View style={{ gap: space.xs }}>
            {rooms.map((room) => {
              const active = room.id === selectedRoomId;
              return (
                <Card
                  key={room.id}
                  style={{
                    padding: space.sm,
                    gap: 4,
                    borderColor: active ? palette.accent : palette.border,
                    backgroundColor: palette.bg,
                  }}
                >
                  <View style={styles.rowBetween}>
                    <AppText variant="cardTitle">{room.name}</AppText>
                    <Chip
                      label={t(`theme_${room.theme}` as "theme_LIBRARY")}
                      selected={active}
                      onPress={() => {
                        void haptics.selection();
                        setSelectedRoomId(room.id);
                      }}
                    />
                  </View>
                  <AppText variant="caption" tone="secondary">
                    {t("room_members_count", {
                      count: room.memberCount,
                      capacity: room.capacity,
                    })}{" "}
                    · {t("room_active_count", { count: room.activeCount })}
                  </AppText>
                </Card>
              );
            })}
          </View>
        )}

        {detail ? (
          <View
            style={{
              padding: space.sm,
              borderRadius: radii.card,
              borderWidth: 1,
              backgroundColor: palette.surfaceAlt,
              borderColor: palette.border,
              gap: space.sm,
            }}
          >
            <AppText variant="cardTitle">{detail.name}</AppText>
            {detail.inviteCode ? (
              <View style={styles.rowBetween}>
                <AppText variant="caption" tone="accent">
                  {t("room_invite_code", { code: detail.inviteCode })}
                </AppText>
                <Chip
                  label={t("rotate_code_cta")}
                  onPress={() => rotateMutation.mutate(detail.id)}
                />
              </View>
            ) : null}

            <View style={{ gap: 6 }}>
              {detail.seats.map((seat) => (
                <View key={seat.userId} style={styles.rowBetween}>
                  <AppText variant="body">{seat.displayName}</AppText>
                  <AppText
                    variant="caption"
                    tone={seat.isSeated ? "success" : "muted"}
                  >
                    {seat.isSeated
                      ? t("seat_active_badge", {
                          minutes: seat.seatedMinutes ?? 1,
                        })
                      : t("seat_idle_badge")}
                  </AppText>
                </View>
              ))}
            </View>

            <Button
              label={t("sit_at_table_cta")}
              onPress={() =>
                router.push({
                  pathname: "/(app)/study-session",
                  params: { title: detail.name },
                })
              }
            />
            <Button
              label={
                detail.role === "OWNER"
                  ? t("close_room_cta")
                  : t("leave_room_cta")
              }
              variant="danger"
              loading={leaveOrCloseMutation.isPending}
              onPress={() => leaveOrCloseMutation.mutate(detail)}
            />
          </View>
        ) : null}
      </Card>

      <Card style={{ gap: space.sm }}>
        <AppText variant="sectionHeading">{t("create_room_title")}</AppText>
        <TextField
          label={t("room_name_label")}
          value={roomName}
          onChangeText={setRoomName}
          placeholder={t("room_name_placeholder")}
        />
        <AppText variant="caption" tone="secondary">
          {t("room_theme_label")}
        </AppText>
        <View style={styles.chipRow}>
          {STUDY_ROOM_THEMES.map((item) => (
            <Chip
              key={item}
              label={t(`theme_${item}` as "theme_LIBRARY")}
              selected={theme === item}
              onPress={() => setTheme(item)}
            />
          ))}
        </View>
        <AppText variant="caption" tone="secondary">
          {t("room_capacity_label")}
        </AppText>
        <View style={styles.chipRow}>
          {STUDY_ROOM_CAPACITIES.map((cap) => (
            <Chip
              key={cap}
              label={String(cap)}
              selected={capacity === cap}
              onPress={() => setCapacity(cap)}
            />
          ))}
        </View>
        <Button
          label={t("create_room_cta")}
          disabled={!roomName.trim()}
          loading={createMutation.isPending}
          onPress={() => createMutation.mutate()}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
