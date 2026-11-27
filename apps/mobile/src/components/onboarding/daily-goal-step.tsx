import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { ApiClientError, usersControllerUpdateMe } from "@mentor/api-client";
import type { AuthUser } from "@mentor/types";
import { haptics } from "../../lib/haptics.js";
import { DAILY_GOAL_PUHU } from "../../lib/onboarding-assets.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button } from "../ui/index.js";
import { MinuteEntryCard, PlayError, PlayGridCard, PlayStepLayout, PlayTitle } from "../onboarding-play/index.js";
import { PushPermissionLayer, usePushPermissionAsk } from "./push-permission-layer.js";

const GOALS = [60, 120, 240, 360] as const;
const RECOMMENDED = 120;
const isValidGoal = (minutes: number | null): minutes is number =>
  minutes != null && Number.isInteger(minutes) && minutes >= 10 && minutes <= 600;

/** The web's `DailyGoalStep`: four levels plus "Kendin yaz", then the reminder ask in the same tap. */
export function DailyGoalStep({
  user, progress, onBack, onSkip, onSaved,
}: {
  user: AuthUser;
  progress: { done: number; total: number } | null;
  onBack: () => void;
  onSkip: () => void;
  onSaved: (minutes: number, reminder: boolean) => void;
}) {
  const t = useTranslations("play");
  const { setUserFromServer } = useAuth();
  const { palette, space, radii } = useThemeTokens();
  const permission = usePushPermissionAsk();
  const [selected, setSelected] = useState<number | null>(() =>
    isValidGoal(user.dailyFocusGoalMinutes) ? user.dailyFocusGoalMinutes : null,
  );
  // "Kendin yaz" stays chosen while typed in, even when the number passes through a preset.
  const [custom, setCustom] = useState(() => selected != null && !GOALS.some((minutes) => minutes === selected));
  const valid = isValidGoal(selected);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const save = async () => {
    if (!valid || saving) return;
    const minutes = selected;
    setSaving(true);
    setErrorMessage(null);
    try {
      const updated = (await usersControllerUpdateMe({ dailyFocusGoalMinutes: minutes })) as unknown as AuthUser;
      setUserFromServer(updated);
    } catch (err) {
      haptics.error();
      setErrorMessage(err instanceof ApiClientError ? err.body.message : t("daily_goal_save_error"));
      setSaving(false);
      return;
    }
    haptics.success();
    const reminder = await permission.ask();
    setSaving(false);
    onSaved(minutes, reminder);
  };

  const rows = [GOALS.slice(0, 2), GOALS.slice(2, 4)];

  return (
    <PlayStepLayout
      progress={progress}
      onBack={onBack}
      busy={saving}
      skipLabel={t("daily_goal_skip")}
      onSkip={onSkip}
      heading={<PlayTitle title={t("daily_goal_title")} />}
      footer={
        <>
          <PlayError message={errorMessage} />
          <Button label={t("daily_goal_continue")} disabled={!valid} loading={saving} onPress={() => void save()} />
        </>
      }
    >
      <View accessibilityRole="radiogroup" style={{ gap: space.md, paddingTop: space.md }}>
        {rows.map((row) => (
          <View key={row[0]} style={{ flexDirection: "row", gap: space.md }}>
            {row.map((minutes) => (
              <PlayGridCard
                key={minutes}
                label={t(`daily_goal_levels_${minutes}`)}
                sub={t("daily_goal_minutes", { minutes })}
                badge={minutes === RECOMMENDED ? t("daily_goal_recommended") : undefined}
                art={<Image source={DAILY_GOAL_PUHU[minutes]} style={styles.puhu} contentFit="contain" accessible={false} />}
                selected={!custom && selected === minutes}
                disabled={saving}
                onSelect={() => {
                  setCustom(false);
                  setSelected(minutes);
                }}
              />
            ))}
          </View>
        ))}
        <View style={{ flexDirection: "row" }}>
          <MinuteEntryCard
            label={t("daily_goal_custom")}
            unit={t("daily_goal_unit")}
            value={selected}
            selected={custom}
            disabled={saving}
            invalidMessage={t("daily_goal_invalid")}
            onChange={(minutes) => {
              setCustom(true);
              setSelected(minutes);
            }}
          />
        </View>
      </View>
      {/* Fixed height keeps the caption from jumping when the first answer lands. */}
      <View accessibilityLiveRegion="polite" style={[styles.reactionSlot, { marginTop: space.lg }]}>
        {valid ? (
          <View style={[styles.reaction, { borderRadius: radii.button, borderColor: palette.playLine, backgroundColor: palette.surface }]}>
            <AppText style={styles.reactionText}>
              {custom ? t("daily_goal_reactions_custom") : t(`daily_goal_reactions_${selected as (typeof GOALS)[number]}`)}
            </AppText>
          </View>
        ) : null}
      </View>
      <AppText tone="secondary" style={[styles.caption, { marginTop: space.sm }]}>{t("daily_goal_caption")}</AppText>
      <PushPermissionLayer
        open={permission.open}
        title={t("push_title", { minutes: selected ?? RECOMMENDED })}
        body={t("push_body")}
        skipLabel={t("push_skip")}
        onSkip={permission.dismiss}
      />
    </PlayStepLayout>
  );
}

const styles = StyleSheet.create({
  puhu: { width: 72, height: 72 },
  reactionSlot: { minHeight: 56 },
  reaction: { borderWidth: 2, paddingHorizontal: 16, paddingVertical: 12 },
  reactionText: { textAlign: "center", fontSize: 16, lineHeight: 22, fontWeight: "700" },
  caption: { textAlign: "center", fontSize: 14, fontWeight: "500" },
});
