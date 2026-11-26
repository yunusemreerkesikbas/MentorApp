import { useState } from "react";
import { Pressable, Share, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useQueryClient } from "@tanstack/react-query";
import { AltArrowLeftIcon } from "@solar-icons/react-native/linear/alt-arrow-left";
import { AltArrowRightIcon } from "@solar-icons/react-native/linear/alt-arrow-right";
import { MinusIcon } from "@solar-icons/react-native/linear/minus";
import { AddIcon } from "@solar-icons/react-native/linear/add";
import { ApiClientError } from "@mentor/api-client";
import type { StudyRoomDetailDto, StudyRoomTheme } from "@mentor/types";
import { createStudyRoom, joinStudyRoom, mapStudyRoomJoinError, rotateStudyRoomCode } from "../../lib/community-api.js";
import { haptics } from "../../lib/haptics.js";
import { ROOM_CAPACITY, ROOM_NAME_MAX, roomInviteLink, stepRoomTheme } from "../../lib/room-view.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { useToast } from "../../providers/toast-provider.js";
import { FormSheet } from "../panel/primitives.js";
import { AppText, Button, TextField } from "../ui/index.js";
import { ROOM_BACKDROP } from "./session-stage.js";

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiClientError && err.body.message ? err.body.message : fallback;

/** The web's `room-create-sheet`: name, a theme banner with arrows (the carousel), 2–10 seats. */
export function RoomCreateSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (room: StudyRoomDetailDto) => void }) {
  const t = useTranslations("sessionRoom");
  const { palette, radii } = useThemeTokens();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [theme, setTheme] = useState<StudyRoomTheme>("LIBRARY");
  const [capacity, setCapacity] = useState<number>(ROOM_CAPACITY.initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const room = await createStudyRoom({ name: name.trim(), theme, capacity });
      haptics.success();
      await queryClient.invalidateQueries({ queryKey: ["study-rooms"] });
      onCreated(room);
    } catch (err) {
      setError(errorText(err, t("error_title")));
    } finally {
      setBusy(false);
    }
  };

  const arrow = (delta: 1 | -1) => (
    <Pressable accessibilityRole="button" accessibilityLabel={t(delta < 0 ? "theme_prev" : "theme_next")} hitSlop={8}
      onPress={() => { haptics.selection(); setTheme(stepRoomTheme(theme, delta)); }} style={styles.bannerArrow}>
      {delta < 0 ? <AltArrowLeftIcon size={20} color="#ffffff" /> : <AltArrowRightIcon size={20} color="#ffffff" />}
    </Pressable>
  );

  return (
    <FormSheet visible title={t("create_title")} closeLabel={t("cancel")} onClose={onClose} closeDisabled={busy}
      footer={<Button label={t("create_submit")} loading={busy} disabled={!name.trim()} onPress={() => void submit()} />}>
      <View style={{ gap: 16 }}>
        <TextField label={t("name_label")} placeholder={t("name_placeholder")} value={name} maxLength={ROOM_NAME_MAX}
          onChangeText={(v) => { setName(v); setError(null); }} />
        <View style={{ gap: 8 }}>
          <AppText variant="caption" tone="secondary" style={{ fontWeight: "700" }}>{t("theme_label")}</AppText>
          <View style={[styles.banner, { borderRadius: radii.inner }]}>
            <Image source={ROOM_BACKDROP[theme]} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessible={false} />
            <View style={styles.bannerVeil} />
            {arrow(-1)}
            <AppText accessibilityLiveRegion="polite" style={styles.bannerLabel}>{t(`theme_${theme}`)}</AppText>
            {arrow(1)}
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <AppText variant="caption" tone="secondary" style={{ fontWeight: "700" }}>{t("capacity_label")}</AppText>
          <View style={styles.stepper}>
            <StepButton label={t("capacity_less")} disabled={capacity <= ROOM_CAPACITY.min} onPress={() => setCapacity(capacity - 1)}>
              <MinusIcon size={20} color={palette.main} />
            </StepButton>
            <AppText style={{ fontWeight: "900", fontSize: 22, minWidth: 36, textAlign: "center" }}>{capacity}</AppText>
            <StepButton label={t("capacity_more")} disabled={capacity >= ROOM_CAPACITY.max} onPress={() => setCapacity(capacity + 1)}>
              <AddIcon size={20} color={palette.main} />
            </StepButton>
            <AppText tone="secondary" style={{ fontWeight: "600" }}>{t("capacity_hint")}</AppText>
          </View>
        </View>
        {error ? <AppText tone="danger">{error}</AppText> : null}
      </View>
    </FormSheet>
  );
}

function StepButton({ label, disabled, onPress, children }: { label: string; disabled: boolean; onPress: () => void; children: React.ReactNode }) {
  const { palette } = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled}
      onPress={() => { haptics.selection(); onPress(); }}
      style={[styles.step, { borderColor: palette.playLine, opacity: disabled ? 0.4 : 1 }]}>
      {children}
    </Pressable>
  );
}

/** The web's join sheet: one code field, the API's join failures in words. */
export function RoomJoinSheet({ onClose, onJoined }: { onClose: () => void; onJoined: (roomId: string) => void }) {
  const t = useTranslations("sessionRoom");
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const room = await joinStudyRoom(code);
      haptics.success();
      await queryClient.invalidateQueries({ queryKey: ["study-rooms"] });
      onJoined(room.id);
    } catch (err) {
      setError(t(`join_failed_${mapStudyRoomJoinError(err)}`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormSheet visible title={t("join_action")} closeLabel={t("cancel")} onClose={onClose} closeDisabled={busy}
      footer={<Button label={t("join_submit")} loading={busy} disabled={!code.trim()} onPress={() => void submit()} />}>
      <View style={{ gap: 12 }}>
        <AppText tone="secondary">{t("join_hint")}</AppText>
        <TextField label={t("join_label")} placeholder={t("join_placeholder")} value={code} autoCapitalize="characters"
          autoCorrect={false} onChangeText={(v) => { setCode(v.toUpperCase()); setError(null); }} errorMessage={error} />
      </View>
    </FormSheet>
  );
}

/**
 * The web's `room-invite-sheet`: the code, share the web link, rotate after a confirm.
 * ponytail: no copy button (no clipboard package); Android's share sheet has "Copy".
 */
export function RoomInviteSheet({ room, onClose }: { room: StudyRoomDetailDto; onClose: () => void }) {
  const t = useTranslations("sessionRoom");
  const { locale } = useLocale();
  const { palette, radii } = useThemeTokens();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const code = room.inviteCode ?? "";

  const share = () => {
    haptics.selection();
    void Share.share({ message: `${t("invite_share_text", { name: room.name })}\n${roomInviteLink(code, locale)}` });
  };

  const rotate = async () => {
    setBusy(true);
    try {
      const next = await rotateStudyRoomCode(room.id);
      queryClient.setQueryData(["study-rooms", "detail", room.id], next);
      haptics.success();
      toast.show(t("invite_rotated"));
      setConfirming(false);
    } catch (err) {
      toast.show(errorText(err, t("error_title")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormSheet visible title={t("invite_title")} closeLabel={t("cancel")} onClose={onClose} closeDisabled={busy}
      footer={confirming ? (
        <View style={{ gap: 8 }}>
          <Button label={t("confirm_rotate_action")} variant="danger" loading={busy} onPress={() => void rotate()} />
          <Button label={t("cancel")} variant="secondary" disabled={busy} onPress={() => setConfirming(false)} />
        </View>
      ) : <Button label={t("invite_share")} disabled={!code} onPress={share} />}>
      {confirming ? (
        <View style={{ gap: 8 }}>
          <AppText variant="cardTitle">{t("confirm_rotate_title")}</AppText>
          <AppText tone="secondary">{t("confirm_rotate_body")}</AppText>
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <AppText tone="secondary">{t("invite_hint")}</AppText>
          <View style={[styles.codeBox, { backgroundColor: palette.surfaceAlt, borderRadius: radii.inner }]}>
            <AppText selectable style={styles.code}>{code}</AppText>
          </View>
          <Pressable accessibilityRole="button" onPress={() => setConfirming(true)} hitSlop={8} style={{ alignSelf: "center" }}>
            <AppText style={{ color: palette.secondary, fontWeight: "800" }}>{t("invite_rotate")}</AppText>
          </Pressable>
        </View>
      )}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  banner: { height: 120, overflow: "hidden", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6 },
  bannerVeil: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.32)" },
  bannerArrow: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.3)" },
  bannerLabel: { color: "#ffffff", fontWeight: "900", fontSize: 20 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  step: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  codeBox: { paddingVertical: 18, alignItems: "center" },
  code: { fontWeight: "900", fontSize: 24, letterSpacing: 2, fontVariant: ["tabular-nums"] },
});
