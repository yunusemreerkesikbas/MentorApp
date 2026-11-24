import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ApiClientError } from "@mentor/api-client";
import type { MentorshipSharedFollowupDto, Paginated } from "@mentor/types";
import { formatDisplayDate } from "../../../lib/display-date.js";
import { haptics } from "../../../lib/haptics.js";
import {
  fetchFollowupAvailability,
  fetchSharedFollowups,
  respondToFollowup,
} from "../../../lib/mentorship-followups-api.js";
import { extractMentorshipError } from "../../../lib/mentorship-view.js";
import { useLocale, useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { useToast } from "../../../providers/toast-provider.js";
import { PanelCard, PanelCardTitle } from "../../panel/primitives.js";
import { AppText, Button, Chip, Skeleton } from "../../ui/index.js";

const PAGE_SIZE = 10;

export function MyCoachFollowupsCard({ reloadSignal = 0 }: { reloadSignal?: number }) {
  const t = useTranslations("students");
  const tCommon = useTranslations("common");
  const { locale } = useLocale();
  const toast = useToast();
  const { palette, space } = useThemeTokens();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<MentorshipSharedFollowupDto> | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const lockedRef = useRef(false);

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
      const res = await fetchSharedFollowups(page, PAGE_SIZE);
      if (page > 1 && res.items.length === 0) {
        setPage(1);
        return;
      }
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
  }, [load, reloadTick, reloadSignal]);

  async function handleRespond(
    item: MentorshipSharedFollowupDto,
    response: "ACCEPTED" | "CHANGE_REQUESTED",
  ) {
    if (lockedRef.current) return;
    lockedRef.current = true;
    setBusyId(item.id);
    try {
      await respondToFollowup(item.id, { version: item.version, response });
      void haptics.success();
      setReloadTick((n) => n + 1);
    } catch (err) {
      void haptics.error();
      toast.show(extractMentorshipError(err, tCommon("error_body")));
    } finally {
      lockedRef.current = false;
      setBusyId(null);
    }
  }

  if (enabled === false) return null;

  const items = data?.items ?? [];

  return (
    <PanelCard style={{ gap: space.sm }}>
      <View style={styles.headerRow}>
        <PanelCardTitle>{t("followup_shared_title")}</PanelCardTitle>
        {data && data.total > 0 ? (
          <AppText variant="caption" tone="secondary" tabularNums>
            {t("followup_count_label", { count: data.total })}
          </AppText>
        ) : null}
      </View>
      <AppText variant="caption" tone="secondary">
        {t("followup_shared_body")}
      </AppText>

      {loading && data === null ? (
        <Skeleton height={84} />
      ) : errorMsg ? (
        <View style={{ gap: space.sm }}>
          <AppText variant="caption" tone="danger">
            {errorMsg}
          </AppText>
          <Button
            label={tCommon("retry")}
            variant="secondary"
            onPress={() => setReloadTick((n) => n + 1)}
          />
        </View>
      ) : items.length === 0 ? (
        <AppText variant="body" tone="secondary">
          {t("followup_shared_empty")}
        </AppText>
      ) : (
        <View>
          {items.map((item, idx) => (
            <View
              key={item.id}
              style={[
                styles.itemRow,
                idx > 0 && { borderTopColor: palette.playLine, borderTopWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <AppText variant="cardTitle">{item.sharedDecision}</AppText>
              <View style={styles.metaRow}>
                <Chip
                  label={
                    item.status === "OPEN"
                      ? t(`followup_response_${item.response}` as "followup_response_PENDING")
                      : t(`followup_status_${item.status}` as "followup_status_COMPLETED")
                  }
                  tone={
                    item.status !== "OPEN"
                      ? "default"
                      : item.response === "ACCEPTED"
                        ? "success"
                        : item.response === "CHANGE_REQUESTED"
                          ? "warning"
                          : "coach"
                  }
                />
                {item.followUpDate ? (
                  <AppText variant="caption" tone="secondary">
                    {t("followup_due", {
                      date: formatDisplayDate(`${item.followUpDate}T12:00:00.000Z`, locale),
                    })}
                  </AppText>
                ) : null}
              </View>

              {item.status === "OPEN" ? (
                <View style={styles.actionRow}>
                  {item.response !== "ACCEPTED" ? (
                    <Button
                      label={t("followup_accept")}
                      loading={busyId === item.id}
                      disabled={busyId !== null}
                      onPress={() => void handleRespond(item, "ACCEPTED")}
                      style={styles.flexBtn}
                    />
                  ) : null}
                  {item.response !== "CHANGE_REQUESTED" ? (
                    <Button
                      label={t("followup_request_change")}
                      variant="secondary"
                      loading={busyId === item.id}
                      disabled={busyId !== null}
                      onPress={() => void handleRespond(item, "CHANGE_REQUESTED")}
                      style={styles.flexBtn}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          ))}

          {data && data.total > PAGE_SIZE ? (
            <View style={styles.pager}>
              <Button
                label={t("pager_prev")}
                variant="secondary"
                disabled={page <= 1 || loading}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                style={styles.flexBtn}
              />
              <Button
                label={t("pager_next")}
                variant="secondary"
                disabled={page * PAGE_SIZE >= data.total || loading}
                onPress={() => setPage((p) => p + 1)}
                style={styles.flexBtn}
              />
            </View>
          ) : null}
        </View>
      )}
    </PanelCard>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  itemRow: {
    paddingVertical: 12,
    gap: 8,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  flexBtn: {
    flex: 1,
    minWidth: 130,
  },
  pager: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 10,
  },
});
