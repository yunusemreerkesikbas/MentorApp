import { useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  MentorshipCoachOverviewDto,
  MentorshipCoachRegistrationStateDto,
} from "@mentor/types";
import { formatDisplayDate } from "../../../lib/display-date.js";
import { haptics } from "../../../lib/haptics.js";
import { rotateInviteCode } from "../../../lib/mentorship-api.js";
import {
  computeSeatCardState,
  extractMentorshipError,
  resolveInviteLock,
} from "../../../lib/mentorship-view.js";
import { useLocale, useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { useToast } from "../../../providers/toast-provider.js";
import { PanelCard, PanelCardTitle, ProgressLine } from "../../panel/primitives.js";
import { AppText, Button, ConfirmDialog, Skeleton } from "../../ui/index.js";

export function CoachInviteSeatsCard({
  overview,
  registrationState,
}: {
  overview: MentorshipCoachOverviewDto | null;
  registrationState: MentorshipCoachRegistrationStateDto | null;
}) {
  const t = useTranslations("students");
  const tCommon = useTranslations("common");
  const { locale } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { palette, radii, space } = useThemeTokens();
  const [confirmRotateOpen, setConfirmRotateOpen] = useState(false);

  const rotateMutation = useMutation({
    mutationFn: rotateInviteCode,
    onSuccess: (nextCode) => {
      void haptics.success();
      queryClient.setQueryData<MentorshipCoachOverviewDto | undefined>(
        ["mentorship-overview"],
        (cur) => (cur ? { ...cur, inviteCode: nextCode } : cur),
      );
      void queryClient.invalidateQueries({ queryKey: ["mentorship-overview"] });
    },
    onError: (err) => {
      void haptics.error();
      toast.show(extractMentorshipError(err, tCommon("error_body")));
    },
  });

  const state = computeSeatCardState(overview, registrationState);
  const lock = resolveInviteLock(registrationState);
  const code = overview?.inviteCode ?? null;

  async function shareInvite() {
    if (!code) return;
    void haptics.selection();
    try {
      await Share.share({
        message: t("invite_share_message", { code: code.code }),
      });
    } catch {
      // User cancelled share sheet
    }
  }

  return (
    <PanelCard style={{ gap: space.sm }}>
      <PanelCardTitle>{t("invite_seats_title")}</PanelCardTitle>

      {state.kind === "loading" ? (
        <Skeleton height={96} />
      ) : state.kind === "closed" ? (
        <AppText variant="body" tone="secondary">
          {t("seats_closed")}
        </AppText>
      ) : state.kind === "locked" ? (
        <AppText variant="body" tone="secondary">
          {t("invite_blocked_NOT_ACTIVE")}
        </AppText>
      ) : (
        <>
          <AppText variant="caption" tone="secondary" tabularNums>
            {t("seats_used_line", { used: state.used, total: state.total })}
          </AppText>
          <ProgressLine
            label={t("invite_seats_title")}
            value={state.used}
            max={state.total}
            complete={false}
          />
          {state.kind === "open" ? (
            <AppText variant="caption" tone="secondary" tabularNums>
              {state.paidSeats > 0
                ? t("seats_split_paid", { free: state.freeSeats, paid: state.paidSeats })
                : t(state.sponsored ? "seats_split_free" : "seats_split_free_plain", {
                    free: state.freeSeats,
                  })}
            </AppText>
          ) : (
            <AppText variant="caption" tone="warning">
              {state.reason === "cap"
                ? t("seats_full_cap", { total: state.limit })
                : t("seats_full_notice", { used: state.used })}
            </AppText>
          )}

          {state.waiting > 0 ? (
            <AppText variant="caption" tone="coach" tabularNums>
              {t("seats_waiting", { count: state.waiting })}
            </AppText>
          ) : null}

          {lock === "PHONE" ? (
            <View
              style={[
                styles.blockerBox,
                { backgroundColor: palette.warningBg, borderRadius: radii.inner },
              ]}
            >
              <AppText variant="caption" tone="warning">
                {t("invite_blocked_PHONE_UNVERIFIED")}
              </AppText>
              <Button
                label={t("open_phone_settings_cta")}
                variant="secondary"
                onPress={() => router.push("/(app)/(tabs)/settings" as never)}
              />
            </View>
          ) : lock === "EMAIL" ? (
            <AppText variant="caption" tone="warning">
              {t("invite_blocked_EMAIL_UNVERIFIED")}
            </AppText>
          ) : state.kind !== "full" ? (
            code ? (
              <View
                style={[
                  styles.inviteBox,
                  {
                    backgroundColor: palette.surfaceAlt,
                    borderColor: palette.border,
                    borderRadius: radii.inner,
                  },
                ]}
              >
                <AppText variant="caption" tone="coach">
                  {t("invite_code_label")}
                </AppText>
                <AppText variant="sectionHeading" selectable tabularNums>
                  {code.code}
                </AppText>
                <AppText variant="micro" tone="secondary">
                  {t("invite_expires_on", {
                    date: formatDisplayDate(code.expiresAt, locale),
                  })}
                </AppText>
                <View style={styles.inviteActions}>
                  <Button
                    label={t("invite_share_cta")}
                    onPress={() => void shareInvite()}
                    style={styles.inviteActionBtn}
                  />
                  <Button
                    label={t("rotate_invite_cta")}
                    variant="secondary"
                    loading={rotateMutation.isPending}
                    onPress={() => setConfirmRotateOpen(true)}
                    style={styles.inviteActionBtn}
                  />
                </View>
              </View>
            ) : (
              <Button
                label={t("invite_create")}
                loading={rotateMutation.isPending}
                onPress={() => rotateMutation.mutate()}
              />
            )
          ) : null}
        </>
      )}

      <ConfirmDialog
        visible={confirmRotateOpen}
        title={t("rotate_invite_cta")}
        message={t("invite_rotate_warning")}
        confirmLabel={t("rotate_invite_cta")}
        cancelLabel={t("cancel_preview_cta")}
        onCancel={() => setConfirmRotateOpen(false)}
        onConfirm={() => {
          setConfirmRotateOpen(false);
          rotateMutation.mutate();
        }}
      />
    </PanelCard>
  );
}

const styles = StyleSheet.create({
  blockerBox: {
    padding: 12,
    gap: 8,
  },
  inviteBox: {
    padding: 12,
    borderWidth: 1,
    gap: 6,
  },
  inviteActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  inviteActionBtn: {
    flexGrow: 1,
    minWidth: 165,
  },
});
