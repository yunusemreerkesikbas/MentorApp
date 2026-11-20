import { StyleSheet, View } from "react-native";
import { ClipboardCheckIcon } from "@solar-icons/react-native/bold/clipboard-check";
import { CheckCircleIcon } from "@solar-icons/react-native/bold/check-circle";
import { LightbulbIcon } from "@solar-icons/react-native/bold/lightbulb";
import { Pen2Icon } from "@solar-icons/react-native/bold/pen-2";
import { PlayIcon } from "@solar-icons/react-native/bold/play";
import { RestartIcon } from "@solar-icons/react-native/bold/restart";
import type { FocusStep, FocusStepKey } from "@mentor/core";
import { mixHex } from "../../lib/layout.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/index.js";

const icons = {
  first_exam: Pen2Icon,
  signal: LightbulbIcon,
  planned: ClipboardCheckIcon,
  practiced: RestartIcon,
  measured: Pen2Icon,
};
type Stop = { key: FocusStepKey | "first_exam"; state: FocusStep["state"] };
const empty: Stop[] = [
  { key: "first_exam", state: "current" },
  { key: "signal", state: "upcoming" },
  { key: "planned", state: "upcoming" },
  { key: "practiced", state: "upcoming" },
];

export function AnalysisFocusSteps({ steps = empty, meta }: {
  steps?: Stop[];
  meta?: Record<FocusStepKey, string | null>;
}) {
  const t = useTranslations("analysisFocus");
  const { palette, radii, space } = useThemeTokens();

  return (
    <View style={[styles.row, { paddingTop: space.xl }]}>
      {steps.map(({ key, state }, index) => {
        const firstExam = key === "first_exam";
        const current = state === "current" && !firstExam;
        const filled = state !== "upcoming" && !firstExam;
        const label = t(`step_${key}`);
        const detail = firstExam ? t("step_first_exam_meta") : meta?.[key];
        const Icon = state === "done" ? CheckCircleIcon : current && key === "practiced" ? PlayIcon : icons[key];
        const size = current ? 60 : 46;
        return (
          <View key={key} accessible accessibilityLabel={[label, t(`state_${state}`), detail].filter(Boolean).join(", ")}
            style={styles.stop}>
            {index < steps.length - 1 ? (
              <View style={[styles.line, { backgroundColor: steps[index + 1]?.state === "upcoming" ? palette.playTrack : palette.ctaPlayBg }]} />
            ) : null}
            <View style={[styles.nodeSlot, { backgroundColor: current ? palette.playSelected : undefined, borderRadius: radii.pill }]}>
              {current ? (
                <AppText variant="micro" numberOfLines={1} style={[styles.tip, { backgroundColor: palette.surface, color: palette.playSelectedInk, borderColor: palette.playLine, borderRadius: radii.pill }]}>
                  {t("next")}
                </AppText>
              ) : null}
              <View style={[styles.node, {
                width: size, height: size, borderRadius: radii.pill,
                backgroundColor: firstExam ? palette.surface : filled ? palette.ctaPlayBg : palette.playTrack,
                borderColor: firstExam ? palette.muted : filled ? palette.ctaPlayEdge : mixHex(palette.main, palette.playTrack, 0.12),
                borderWidth: firstExam ? 2 : 0, borderStyle: firstExam ? "dashed" : "solid",
                borderBottomWidth: firstExam ? 2 : 4,
              }]}>
                <Icon size={current ? 27 : 23} color={filled ? palette.ctaPlayInk : palette.secondary} />
              </View>
            </View>
            <AppText variant="caption" style={styles.label}>{label}</AppText>
            {detail ? <AppText variant="micro" tone="secondary" style={styles.detail}>{detail}</AppText> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  stop: { flex: 1, minWidth: 0, alignItems: "center" },
  line: { position: "absolute", left: "50%", width: "100%", top: 34, height: 4 },
  nodeSlot: { width: 68, height: 68, alignItems: "center", justifyContent: "center" },
  node: { alignItems: "center", justifyContent: "center" },
  tip: { position: "absolute", top: -24, zIndex: 1, borderWidth: 2, paddingHorizontal: 7, fontWeight: "900" },
  label: { marginTop: 6, textAlign: "center", fontWeight: "800", lineHeight: 16 },
  detail: { textAlign: "center", lineHeight: 14 },
});
