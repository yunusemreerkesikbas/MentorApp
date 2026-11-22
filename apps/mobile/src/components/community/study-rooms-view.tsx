import { useEffect, useMemo, useState } from "react";
import { Pressable, Share, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ApiClientError } from "@mentor/api-client";
import type { StudyRoomDto, StudyRoomTheme } from "@mentor/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  closeStudyRoom,
  createStudyRoom,
  getStudyRoom,
  joinStudyRoom,
  leaveStudyRoom,
  listStudyRooms,
  mapStudyRoomJoinError,
  rotateStudyRoomCode,
} from "../../lib/community-api.js";
import { haptics } from "../../lib/haptics.js";
import { useAppAvailability } from "../../providers/availability-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { useToast } from "../../providers/toast-provider.js";
import { LedgeButton, PanelCard } from "../panel/primitives.js";
import {
  AppText,
  Button,
  Chip,
  ConfirmDialog,
  ScreenLoadingSkeleton,
  StateView,
  TextField,
} from "../ui/index.js";
import { CommunityAvatar } from "./community-avatar.js";

const THEMES: StudyRoomTheme[] = ["LIBRARY", "CAFE", "HOME"];
const CAPACITIES = [4, 8, 12] as const;

export function StudyRoomsView({
  onOpenMember,
}: {
  onOpenMember: (username: string) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { availability } = useAppAvailability();
  const { palette, radii } = useThemeTokens();
  const t = useTranslations("community");
  const tCommon = useTranslations("common");
  const toast = useToast();

  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomTheme, setRoomTheme] = useState<StudyRoomTheme>("LIBRARY");
  const [roomCapacity, setRoomCapacity] = useState<number>(8);
  const [creating, setCreating] = useState(false);

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [confirmKind, setConfirmKind] = useState<"leave" | "close" | null>(null);

  const roomsQuery = useQuery({
    queryKey: ["study-rooms", "list"],
    queryFn: listStudyRooms,
    enabled: availability.studyRooms,
  });

  const rooms: StudyRoomDto[] = useMemo(() => roomsQuery.data ?? [], [roomsQuery.data]);
  const activeRoomId = useMemo(() => {
    if (selectedRoomId && rooms.some((r) => r.id === selectedRoomId)) return selectedRoomId;
    return rooms[0]?.id ?? null;
  }, [rooms, selectedRoomId]);

  useEffect(() => {
    if (activeRoomId !== selectedRoomId) setSelectedRoomId(activeRoomId);
  }, [activeRoomId, selectedRoomId]);

  const detailQuery = useQuery({
    queryKey: ["study-rooms", "detail", activeRoomId],
    queryFn: () => getStudyRoom(activeRoomId!),
    enabled: Boolean(activeRoomId) && availability.studyRooms,
    refetchInterval: 20_000,
  });

  async function handleJoin() {
    if (!joinCode.trim() || joining) return;
    setJoining(true);
    setJoinError(null);
    try {
      const joined = await joinStudyRoom(joinCode);
      haptics.success();
      setJoinCode("");
      await queryClient.invalidateQueries({ queryKey: ["study-rooms"] });
      setSelectedRoomId(joined.id);
    } catch (err) {
      const kind = mapStudyRoomJoinError(err);
      const errKey =
        kind === "invalid"
          ? "join_err_invalid"
          : kind === "malformed"
            ? "join_err_malformed"
            : kind === "full"
              ? "join_err_full"
              : kind === "quota"
                ? "join_err_quota"
                : "join_err_error";
      setJoinError(t(errKey));
    } finally {
      setJoining(false);
    }
  }

  async function handleCreate() {
    if (!roomName.trim() || creating) return;
    setCreating(true);
    try {
      const created = await createStudyRoom({
        name: roomName.trim(),
        theme: roomTheme,
        capacity: roomCapacity,
      });
      haptics.success();
      setRoomName("");
      setCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["study-rooms"] });
      setSelectedRoomId(created.id);
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : t("room_action_error"));
    } finally {
      setCreating(false);
    }
  }

  async function handleRotateCode() {
    if (!activeRoomId || actionBusy) return;
    setActionBusy(true);
    try {
      await rotateStudyRoomCode(activeRoomId);
      haptics.selection();
      await queryClient.invalidateQueries({ queryKey: ["study-rooms", "detail", activeRoomId] });
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : t("room_action_error"));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleConfirmLeaveOrClose() {
    if (!activeRoomId || !confirmKind || actionBusy) return;
    setActionBusy(true);
    try {
      if (confirmKind === "close") await closeStudyRoom(activeRoomId);
      else await leaveStudyRoom(activeRoomId);
      setConfirmKind(null);
      setSelectedRoomId(null);
      await queryClient.invalidateQueries({ queryKey: ["study-rooms"] });
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : t("room_action_error"));
    } finally {
      setActionBusy(false);
    }
  }

  if (!availability.studyRooms) {
    return <StateView title={t("soon_title")} body={t("soon_desc")} />;
  }

  if (roomsQuery.isLoading) {
    return <ScreenLoadingSkeleton />;
  }

  if (roomsQuery.isError) {
    return (
      <StateView
        tone="error"
        title={t("error_title")}
        body={roomsQuery.error instanceof ApiClientError ? roomsQuery.error.message : t("room_action_error")}
        actionLabel={t("retry")}
        onAction={() => void roomsQuery.refetch()}
      />
    );
  }

  const detail = detailQuery.data;

  return (
    <View style={styles.root}>
      <PanelCard style={styles.cardGap}>
        <TextField
          label={t("join_code_label")}
          placeholder={t("join_code_placeholder")}
          value={joinCode}
          autoCapitalize="characters"
          onChangeText={(val) => {
            setJoinCode(val);
            if (joinError) setJoinError(null);
          }}
          errorMessage={joinError}
        />
        <View style={styles.rowBtns}>
          <View style={styles.flexBtn}>
            <Button
              label={t("join_room_cta")}
              onPress={() => void handleJoin()}
              loading={joining}
              disabled={!joinCode.trim()}
              variant="primary"
            />
          </View>
          <Button
            label={createOpen ? tCommon("cancel") : t("create_room_title")}
            onPress={() => setCreateOpen((v) => !v)}
            variant="secondary"
          />
        </View>
      </PanelCard>

      {createOpen ? (
        <PanelCard style={styles.cardGap}>
          <AppText variant="cardTitle">{t("create_room_title")}</AppText>
          <TextField
            label={t("room_name_label")}
            placeholder={t("room_name_placeholder")}
            value={roomName}
            onChangeText={setRoomName}
            maxLength={40}
          />
          <AppText variant="caption" tone="secondary">
            {t("room_theme_label")}
          </AppText>
          <View style={styles.chipsWrap}>
            {THEMES.map((item) => (
              <Chip
                key={item}
                label={t(
                  item === "LIBRARY" ? "theme_LIBRARY" : item === "CAFE" ? "theme_CAFE" : "theme_HOME",
                )}
                selected={roomTheme === item}
                onPress={() => setRoomTheme(item)}
              />
            ))}
          </View>
          <AppText variant="caption" tone="secondary">
            {t("room_capacity_label")}
          </AppText>
          <View style={styles.chipsWrap}>
            {CAPACITIES.map((cap) => (
              <Chip
                key={cap}
                label={String(cap)}
                selected={roomCapacity === cap}
                onPress={() => setRoomCapacity(cap)}
              />
            ))}
          </View>
          <Button
            label={t("create_room_cta")}
            onPress={() => void handleCreate()}
            loading={creating}
            disabled={!roomName.trim()}
            variant="primary"
          />
        </PanelCard>
      ) : null}

      {rooms.length === 0 ? (
        <StateView title={t("my_rooms_title")} body={t("rooms_empty")} />
      ) : (
        <View style={styles.cardGap}>
          <AppText variant="micro" tone="muted">
            {t("my_rooms_title")}
          </AppText>
          <View style={styles.chipsWrap}>
            {rooms.map((room) => (
              <Chip
                key={room.id}
                label={`${room.name} (${room.activeCount})`}
                selected={room.id === activeRoomId}
                onPress={() => setSelectedRoomId(room.id)}
              />
            ))}
          </View>

          {detail ? (
            <PanelCard style={styles.cardGap}>
              <View style={styles.detailHeader}>
                <AppText variant="title" style={{ flex: 1 }}>
                  {detail.name}
                </AppText>
                <Chip label={t("room_members_count", { count: detail.memberCount, capacity: detail.capacity })} />
              </View>
              <AppText variant="caption" tone="secondary">
                {t("room_active_count", { count: detail.activeCount })}
              </AppText>

              {detail.inviteCode ? (
                <View style={[styles.codeRow, { backgroundColor: palette.surfaceAlt, borderRadius: radii.inner }]}>
                  <AppText variant="caption" style={{ fontWeight: "800", flex: 1 }} selectable>
                    {t("room_invite_code", { code: detail.inviteCode })}
                  </AppText>
                  <Button
                    label={t("share_code_cta")}
                    variant="secondary"
                    onPress={() => void Share.share({ message: t("share_code_message", { code: detail.inviteCode ?? "" }) })}
                  />
                  <Button
                    label={t("rotate_code_cta")}
                    variant="secondary"
                    loading={actionBusy}
                    onPress={() => void handleRotateCode()}
                  />
                </View>
              ) : null}

              <LedgeButton
                accessibilityLabel={t("sit_at_table_cta")}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/study-session",
                    params: { title: detail.name, roomId: detail.id },
                  })
                }
              >
                {(ink) => (
                  <AppText style={{ color: ink, fontSize: 15, fontWeight: "800" }} numberOfLines={1}>
                    {t("sit_at_table_cta")}
                  </AppText>
                )}
              </LedgeButton>

              <View style={styles.seatsList}>
                {detail.seats.map((seat) => (
                  <Pressable
                    key={seat.userId}
                    accessibilityRole="button"
                    disabled={!seat.username}
                    onPress={() => seat.username && onOpenMember(seat.username)}
                    style={[styles.seatRow, { borderColor: palette.playLine, borderRadius: radii.inner }]}
                  >
                    <CommunityAvatar name={seat.displayName} avatarUrl={seat.avatarUrl} size={32} />
                    <View style={{ flex: 1 }}>
                      <AppText style={{ fontWeight: "700" }} numberOfLines={1}>
                        {seat.displayName}
                      </AppText>
                      <AppText variant="caption" tone="muted" numberOfLines={1}>
                        {seat.subject ?? (seat.isSeated ? t("seat_active_badge", { minutes: seat.seatedMinutes ?? 0 }) : t("seat_idle_badge"))}
                      </AppText>
                    </View>
                    <Chip
                      label={
                        seat.isSeated
                          ? t("seat_active_badge", { minutes: seat.seatedMinutes ?? 0 })
                          : t("seat_idle_badge")
                      }
                      tone={seat.isSeated ? "success" : "default"}
                    />
                  </Pressable>
                ))}
              </View>

              <Button
                label={detail.role === "OWNER" ? t("close_room_cta") : t("leave_room_cta")}
                onPress={() => setConfirmKind(detail.role === "OWNER" ? "close" : "leave")}
                variant="danger"
              />
            </PanelCard>
          ) : null}
        </View>
      )}

      <ConfirmDialog
        visible={confirmKind !== null}
        title={confirmKind === "close" ? t("close_room_confirm_title") : t("leave_room_confirm_title")}
        message={confirmKind === "close" ? t("close_room_confirm_body") : t("leave_room_confirm_body")}
        confirmLabel={confirmKind === "close" ? t("close_room_cta") : t("leave_room_cta")}
        cancelLabel={tCommon("cancel")}
        destructive
        onCancel={() => setConfirmKind(null)}
        onConfirm={() => void handleConfirmLeaveOrClose()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  cardGap: { gap: 10 },
  rowBtns: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  flexBtn: { flex: 1 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  detailHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  codeRow: { padding: 10, gap: 8, flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  seatsList: { gap: 8 },
  seatRow: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
