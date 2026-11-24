import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ApiClientError } from "@mentor/api-client";
import { AltArrowRightIcon } from "@solar-icons/react-native/linear/alt-arrow-right";
import type { MentorshipFollowupDto, Paginated } from "@mentor/types";
import { formatDisplayDate } from "../../../lib/display-date.js";
import { haptics } from "../../../lib/haptics.js";
import {
  fetchFollowupAvailability,
  fetchMentorshipFollowups,
} from "../../../lib/mentorship-followups-api.js";
import { extractMentorshipError } from "../../../lib/mentorship-view.js";
import { useLocale, useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { PanelCard, PanelCardTitle } from "../../panel/primitives.js";
import { AppText, Button, Chip, Skeleton } from "../../ui/index.js";
import { CoachAvatar } from "../coach-identity-badges.js";

const PAGE_SIZE = 5;

export function CoachFollowupInboxCard({ reloadSignal }: { reloadSignal: number }) {
  const t = useTranslations("students");
  const tCommon = useTranslations("common");
  const { locale } = useLocale();
  const router = useRouter();
  const { palette, space } = useThemeTokens();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<MentorshipFollowupDto> | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const avail = await fetchFollowupAvailability();
      if (!avail.enabled) {
        setEnabled(false);
        setData(null);
        return;
      }
      setEnabled(true);
      const res = await fetchMentorshipFollowups({ view: "ACTIONABLE", page, pageSize: PAGE_SIZE });
      setData(res);
    } catch (err) {
      if (err instanceof ApiClientError && err.body.code === "MENTORSHIP_FOLLOWUP_DISABLED") {
        setEnabled(false);
        return;
      }
      setEnabled(true);
      setErrorMsg(extractMentorshipError(err, tCommon("error_body")));
    } finally {
      setLoading(false);
    }
  }, [page, tCommon]);

  useEffect(() => {
    void load();
  }, [load, reloadSignal, tick]);

  if (enabled === false) return null;
  if (enabled === null && loading) return <Skeleton height={88} />;

  const items = data?.items ?? [];

  return (
    <PanelCard style={{ gap: space.sm }}>
      <PanelCardTitle>{t("followup_inbox_title")}</PanelCardTitle>
      {loading && data === null ? (
        <Skeleton height={72} />
      ) : errorMsg ? (
        <View style={{ gap: space.sm }}>
          <AppText variant="caption" tone="danger">
            {errorMsg}
          </AppText>
          <Button label={tCommon("retry")} variant="secondary" onPress={() => setTick((n) => n + 1)} />
        </View>
      ) : items.length === 0 ? (
        <AppText variant="body" tone="secondary">
          {t("followup_inbox_empty")}
        </AppText>
      ) : (
        <View>
          {items.map((item, idx) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() => {
                void haptics.selection();
                router.push({
                  pathname: "/(app)/coach-student" as never,
                  params: { studentId: item.studentId, tab: "followups" },
                });
              }}
              style={({ pressed }) => [
                styles.row,
                idx > 0 && {
                  borderTopColor: palette.playLine,
                  borderTopWidth: StyleSheet.hairlineWidth,
                },
                pressed && { backgroundColor: palette.surfaceHover },
              ]}
            >
              <CoachAvatar name={item.studentDisplayName} size={36} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="cardTitle">{item.studentDisplayName}</AppText>
                <AppText variant="caption" tone="secondary" numberOfLines={2}>
                  {item.title}
                </AppText>
                <View style={styles.tagRow}>
                  {item.response === "CHANGE_REQUESTED" ? (
                    <Chip label={t("followup_changes_requested")} tone="warning" />
                  ) : item.followUpDate ? (
                    <AppText variant="micro" tone="secondary">
                      {t("followup_check_on", {
                        date: formatDisplayDate(`${item.followUpDate}T12:00:00.000Z`, locale),
                      })}
                    </AppText>
                  ) : null}
                </View>
              </View>
              <AltArrowRightIcon size={18} color={palette.secondary} />
            </Pressable>
          ))}

          {data && data.total > PAGE_SIZE ? (
            <View style={styles.pager}>
              <Button
                label={t("pager_prev")}
                variant="secondary"
                disabled={page <= 1 || loading}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                style={{ flex: 1 }}
              />
              <Button
                label={t("pager_next")}
                variant="secondary"
                disabled={page * PAGE_SIZE >= data.total || loading}
                onPress={() => setPage((p) => p + 1)}
                style={{ flex: 1 }}
              />
            </View>
          ) : null}
        </View>
      )}
    </PanelCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 2,
  },
  pager: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 8,
  },
});
