import { useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ClockCircleIcon } from "@solar-icons/react-native/linear/clock-circle";
import { clockSuffix, planAccessView } from "@mentor/core";
import type { PlanPreviewAccessDto } from "@mentor/types";
import { nextAvailableParts, planNoticeText, type PlanCoinSheetState } from "../../../lib/plan-puhu.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { CoinsGlyph } from "../../navigation/app-header.js";
import { FormSheet, ProgressLine } from "../../panel/primitives.js";
import { Button } from "../../ui/index.js";
import { AppText } from "../../ui/text.js";
import { UnlockCaption, UnlockConfirm, UnlockPips, UnlockRow } from "../../unlock/unlock-rows.js";

/**
 * "Puhu'yla planla" on the Coin path (the web's `PlanCoinSheet` with purchases off): Coin first,
 * the wizard after. The phone never sells Premium, so there is no Premium row, trial or paywall.
 * `sheet: null` closes it; the last state stays drawn while it fades out.
 */
export function PlanPuhuCoinSheet({
  offer,
  sheet,
  busy,
  onArm,
  onConfirm,
  onCancel,
  onRetry,
  onSaved,
  onClose,
  onDismiss,
}: {
  offer: PlanPreviewAccessDto | null;
  sheet: PlanCoinSheetState | null;
  busy: boolean;
  onArm: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onSaved: () => void;
  onClose: () => void;
  /** iOS: the sheet has finished closing (see `createDismissQueue`). */
  onDismiss?: () => void;
}) {
  const t = useTranslations("planCoin");
  const { palette } = useThemeTokens();
  const last = useRef<{ offer: PlanPreviewAccessDto; sheet: PlanCoinSheetState } | null>(null);
  if (offer && sheet) last.current = { offer, sheet };
  const shown = last.current;
  if (!shown) return null;

  const view = planAccessView(shown.offer, false);
  const { coinConfirmed: balance, dailyLimit: limit, dailyRemaining: remaining } = shown.offer;
  const resume = shown.sheet.resume;
  const cost = resume?.cost ?? shown.offer.cost ?? 0;
  const confirming = Boolean(resume) || (shown.sheet.armed && view.kind === "choice" && view.coin === "ready");

  const nextCaption = () => {
    if (!shown.offer.nextAvailableAt) return null;
    const { day, time } = nextAvailableParts(shown.offer.nextAvailableAt, new Date());
    return t(day === "today" ? "next_available_today" : "next_available_tomorrow", {
      time,
      suffix: clockSuffix(time),
    });
  };

  const body = (() => {
    if (confirming) {
      return (
        <UnlockConfirm
          flush
          title={resume ? t("resume_title") : t("coin_title", { cost })}
          lead={t("confirm_lead")}
          from={String(balance)}
          to={t("coin_amount", { amount: balance - cost })}
          note={t(resume ? "resume_note" : "confirm_note")}
          confirmLabel={t(resume ? "resume_confirm" : "confirm")}
          cancelLabel={t("cancel")}
          busy={busy}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );
    }
    switch (view.kind) {
      case "choice": {
        const caption =
          view.coin === "ready"
            ? t("coin_ready")
            : view.coin === "short"
              ? t("coin_short", { missing: view.missing })
              : nextCaption();
        return (
          <>
            {view.coin ? (
              <>
                <AppText accessibilityRole="header" style={[styles.choose, { color: palette.main }]}>
                  {t("choose")}
                </AppText>
                <UnlockRow
                  title={view.coin === "limit" ? t("limit_title") : t("coin_title", { cost })}
                  icon={<CoinsGlyph color={palette.ctaPlayBg} size={22} />}
                  aside={
                    view.coin === "ready"
                      ? t("balance", { balance })
                      : view.coin === "short"
                        ? `${balance}/${cost}`
                        : undefined
                  }
                >
                  {view.coin === "short" ? (
                    <ProgressLine label={t("coin_progress")} value={balance} max={cost} />
                  ) : (
                    <UnlockPips
                      limit={limit}
                      remaining={remaining}
                      label={t("allowance_label", { limit, remaining })}
                      text={t("allowance", { limit })}
                    />
                  )}
                  {caption ? <UnlockCaption>{caption}</UnlockCaption> : null}
                  {view.lead === "coin" ? (
                    <Button label={t("coin", { cost })} loading={busy} onPress={onArm} />
                  ) : null}
                </UnlockRow>
              </>
            ) : null}
            <AppText variant="caption" tone="secondary" style={styles.savedDetail}>
              {t("saved_detail")}
            </AppText>
          </>
        );
      }
      case "retry":
        return (
          <View accessibilityRole="alert">
            <UnlockRow
              flush
              title={t("unavailable_title")}
              icon={<ClockCircleIcon size={22} color={palette.secondary} />}
            >
              <UnlockCaption>{t("unavailable_detail")}</UnlockCaption>
              <Button label={t("retry")} variant="secondary" loading={busy} onPress={onRetry} />
            </UnlockRow>
          </View>
        );
      case "notice":
      case "paywall":
        return (
          <AppText variant="body" tone="secondary" style={styles.semibold}>
            {planNoticeText(shown.offer, t("phone_closed"))}
          </AppText>
        );
      default:
        return null;
    }
  })();

  return (
    <FormSheet
      visible={Boolean(offer && sheet)}
      title={t("title")}
      closeLabel={t("close")}
      closeDisabled={busy}
      onClose={onClose}
      onDismiss={onDismiss}
    >
      {shown.sheet.error ? (
        <AppText accessibilityRole="alert" variant="caption" tone="danger" style={styles.semibold}>
          {shown.sheet.error}
        </AppText>
      ) : null}
      {body}
      {shown.offer.latestRequestId && !confirming ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onSaved}
          style={styles.savedLink}
        >
          <AppText numberOfLines={1} style={[styles.savedLinkText, { color: palette.playSelectedInk }]}>
            {t("saved")}
          </AppText>
        </Pressable>
      ) : null}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  semibold: {
    fontWeight: "600",
  },
  choose: {
    marginBottom: 12,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  savedDetail: {
    marginTop: 4,
    textAlign: "center",
    fontWeight: "600",
  },
  savedLink: {
    minHeight: 44,
    alignSelf: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  savedLinkText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
  },
});
