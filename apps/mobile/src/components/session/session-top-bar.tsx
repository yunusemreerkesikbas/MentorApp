import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { BookIcon } from "@solar-icons/react-native/linear/book";
import { AltArrowDownIcon } from "@solar-icons/react-native/linear/alt-arrow-down";
import { MusicNoteIcon } from "@solar-icons/react-native/linear/music-note";
import { MusicNotesIcon } from "@solar-icons/react-native/linear/music-notes";
import { VolumeCrossIcon } from "@solar-icons/react-native/linear/volume-cross";
import type { StudyRoomTheme } from "@mentor/types";
import { fetchExamTaxonomy } from "../../lib/analysis-api.js";
import { haptics } from "../../lib/haptics.js";
import { AMBIENT_TRACK_IDS, ROOM_THEMES, type AmbientPreference, type AmbientTrackId } from "../../lib/session-view.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { ActionSheet, FormSheet, type SheetAction } from "../panel/primitives.js";
import { AppText } from "../ui/index.js";
import { useStageLook } from "./session-stage.js";

const TRACK_LABEL = {
  scene: "track_scene",
  library: "track_library",
  cafe: "track_cafe",
  home: "track_home",
  off: "track_off",
} as const satisfies Record<AmbientTrackId, string>;

/**
 * The web's `SessionTopBar` at phone width: one glass strip with the subject, the scene menu
 * (rooms + plain view) and the room sound. Popovers become bottom sheets.
 */
export function SessionTopBar({
  subject,
  onSubjectChange,
  readOnlySubject,
  theme,
  plain,
  onThemeChange,
  onTogglePlain,
  ambient,
  onAmbientTrackChange,
  onAmbientToggleMute,
}: {
  subject: string | null;
  onSubjectChange: (subject: string | null) => void;
  readOnlySubject: boolean;
  theme: StudyRoomTheme;
  plain: boolean;
  onThemeChange: (theme: StudyRoomTheme) => void;
  onTogglePlain: () => void;
  ambient: AmbientPreference;
  onAmbientTrackChange: (trackId: AmbientTrackId) => void;
  onAmbientToggleMute: () => void;
}) {
  const t = useTranslations("session");
  const tRoom = useTranslations("sessionRoom");
  const tAmbient = useTranslations("sessionAmbient");
  const look = useStageLook();
  const [sheet, setSheet] = useState<"scene" | "sound" | "subject" | null>(null);

  const sceneLabel = plain ? tRoom("plain_view_on") : tRoom(`theme_${theme}`);
  const sceneActions: SheetAction[] = [
    ...ROOM_THEMES.map((id) => ({
      label: `${!plain && id === theme ? "✓ " : ""}${tRoom(`theme_${id}`)}`,
      onPress: () => {
        if (id !== theme) onThemeChange(id);
        if (plain) onTogglePlain();
      },
    })),
    { label: tRoom(plain ? "plain_view_off" : "plain_view_on"), onPress: onTogglePlain },
  ];
  const soundActions: SheetAction[] = [
    ...AMBIENT_TRACK_IDS.map((id) => ({
      label: `${ambient.trackId === id ? "✓ " : ""}${tAmbient(TRACK_LABEL[id])}`,
      onPress: () => onAmbientTrackChange(id),
    })),
    ...(ambient.trackId !== "off"
      ? [{ label: tAmbient(ambient.muted ? "unmute" : "mute"), onPress: onAmbientToggleMute }]
      : []),
  ];

  return (
    <>
      <View style={[styles.strip, { backgroundColor: look.glass, borderColor: look.glassBorder }]}>
        <Segment flex label={t("subject_pick_label")} disabled={readOnlySubject}
          onPress={() => setSheet("subject")}
          icon={<BookIcon size={16} color={look.ink} />}
          text={subject ?? t("subject_none")} chevron={!readOnlySubject} />
        <Divider />
        <Segment capped label={tRoom("scene_menu", { scene: sceneLabel })} onPress={() => setSheet("scene")}
          text={sceneLabel} chevron />
        <Divider />
        <Segment label={tAmbient("picker_label")} onPress={() => setSheet("sound")}
          icon={ambient.trackId === "off" ? <MusicNoteIcon size={18} color={look.inkSoft} />
            : ambient.muted ? <VolumeCrossIcon size={18} color={look.ink} />
            : <MusicNotesIcon size={18} color={look.ink} />} />
      </View>

      <ActionSheet title={sheet === "scene" ? tRoom("theme_label") : null} actions={sceneActions} onClose={() => setSheet(null)} />
      <ActionSheet title={sheet === "sound" ? tAmbient("picker_label") : null} actions={soundActions} onClose={() => setSheet(null)} />
      <SubjectSheet visible={sheet === "subject"} value={subject} onClose={() => setSheet(null)}
        onChange={(next) => { onSubjectChange(next); setSheet(null); }} />
    </>
  );
}

function Segment({ label, onPress, icon, text, chevron, flex, capped, disabled }: {
  label: string; onPress: () => void; icon?: ReactNode; text?: string; chevron?: boolean; flex?: boolean;
  /** Never wider than ~40% of the strip, so a long scene name cannot squeeze the subject to "..". */
  capped?: boolean; disabled?: boolean;
}) {
  const look = useStageLook();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled}
      onPress={() => { haptics.selection(); onPress(); }}
      style={({ pressed }) => [styles.segment, flex && styles.flex, capped && styles.capped, pressed && { opacity: 0.7 }]}>
      {icon}
      {text ? <AppText numberOfLines={1} style={[styles.segmentText, (flex || capped) && styles.shrink, { color: look.ink }]}>{text}</AppText> : null}
      {chevron ? <AltArrowDownIcon size={14} color={look.inkSoft} /> : null}
    </Pressable>
  );
}

function Divider() {
  const look = useStageLook();
  return <View style={[styles.divider, { backgroundColor: look.glassBorder }]} />;
}

/** The web's `SessionSubjectPicker`: the exam's subjects, tap again to clear. */
function SubjectSheet({ visible, value, onChange, onClose }: {
  visible: boolean; value: string | null; onChange: (subject: string | null) => void; onClose: () => void;
}) {
  const t = useTranslations("session");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { palette, radii } = useThemeTokens();
  const { user } = useAuth();
  const examType = user?.examType ?? null;
  const examVariant = user?.examVariant ?? null;
  const taxonomy = useQuery({
    queryKey: ["exam-taxonomy", examType, examVariant],
    queryFn: () => fetchExamTaxonomy(examType!, examVariant),
    enabled: examType !== null,
  });
  const subjects = taxonomy.data?.subjects ?? [];

  return (
    <FormSheet visible={visible} title={t("subject_pick_label")} closeLabel={tCommon("close")} onClose={onClose}>
      {examType === null ? (
        <View style={styles.sheetEmpty}>
          <AppText tone="secondary">{t("subject_pick_hint")}</AppText>
          <Pressable accessibilityRole="link" onPress={() => { onClose(); router.push("/(app)/(tabs)/settings" as never); }}>
            <AppText style={{ color: palette.progress, fontWeight: "700" }}>{t("subject_pick_cta")}</AppText>
          </Pressable>
        </View>
      ) : taxonomy.isPending ? (
        <ActivityIndicator color={palette.main} />
      ) : subjects.length === 0 ? (
        <AppText tone="secondary">{t("subject_pick_empty")}</AppText>
      ) : (
        subjects.map((item) => {
          const selected = value === item.name;
          return (
            <Pressable key={item.slug} accessibilityRole="radio" accessibilityState={{ selected }}
              onPress={() => { haptics.selection(); onChange(selected ? null : item.name); }}
              style={({ pressed }) => [styles.subjectRow, {
                borderRadius: radii.inner,
                backgroundColor: selected ? palette.playSelected : pressed ? palette.surfaceHover : palette.surfaceAlt,
              }]}>
              <AppText style={{ fontWeight: "700", color: selected ? palette.playSelectedInk : palette.main }}>
                {selected ? `✓ ${item.name}` : item.name}
              </AppText>
            </Pressable>
          );
        })
      )}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row", alignItems: "center", alignSelf: "stretch", minHeight: 52, padding: 4,
    borderRadius: 999, borderWidth: 1,
  },
  segment: { minHeight: 44, minWidth: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 12 },
  flex: { flex: 1, flexShrink: 1 },
  shrink: { flexShrink: 1 },
  capped: { maxWidth: "40%", flexShrink: 1 },
  segmentText: { fontSize: 15, fontWeight: "700" },
  divider: { width: 1, height: 24 },
  sheetEmpty: { gap: 12 },
  subjectRow: { minHeight: 48, justifyContent: "center", paddingHorizontal: 16, marginBottom: 8 },
});
