import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { recapAccessView } from "@mentor/core";
import type { WeeklyRecapOfferDto } from "@mentor/types";
import { art, careerArt, recapArt } from "../../lib/art.js";
import { cardShadow } from "../../lib/layout.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { CoinsGlyph } from "../navigation/app-header.js";
import { ProgressLine } from "../panel/primitives.js";
import { Button } from "../ui/index.js";
import { AppText } from "../ui/text.js";
import { UnlockCaption, UnlockConfirm, UnlockPips, UnlockRow } from "../unlock/unlock-rows.js";
import { RECAP } from "./recap-colors.js";
import { formatRecapInstant, formatRecapRange } from "./recap-format.js";

/**
 * The locked weekly story (the web's `WeeklyRecapAccessCard` at phone width): its coral cover with
 * the free basic numbers, then how to open it. Premium is never sold here: mobile shows no upsell,
 * so the core view runs with purchases off and the Premium row never appears.
 */
export function RecapAccessCard({
  offer,
  busy,
  armed,
  error,
  onOpen,
  onCancel,
  onRetry,
}: {
  offer: WeeklyRecapOfferDto;
  busy: boolean;
  armed: boolean;
  error: string | null;
  onOpen: () => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const t = useTranslations("recap");
  const { locale } = useLocale();
  const { user } = useAuth();
  const { palette, radii } = useThemeTokens();
  const view = recapAccessView(offer, false);
  const { coinConfirmed: balance, cost, coinLimit: limit, coinRemaining: remaining, windowDays: days } = offer;
  const member = view.kind === "member";
  const confirming = armed && view.kind === "choice" && view.coin === "ready";
  const puhu = member
    ? art.puhuPremiumHero
    : user?.careerGroup
      ? careerArt[user.careerGroup]
      : recapArt.puhu.happy;
  const opening = busy ? t("access_preparing") : null;

  const body = (() => {
    switch (view.kind) {
      case "gift":
        return (
          <UnlockRow title={t("access_gift_title")} flush>
            <UnlockCaption>{t("access_gift_detail")}</UnlockCaption>
            <Button label={opening ?? t("access_earned")} loading={busy} onPress={onOpen} />
          </UnlockRow>
        );
      case "member":
        return (
          <UnlockRow title={t("access_member_title")} flush>
            <UnlockCaption>{t("access_member_detail")}</UnlockCaption>
            <Button label={opening ?? t("access_open")} loading={busy} onPress={onOpen} />
          </UnlockRow>
        );
      case "owned":
        return <Button label={t("access_replay")} loading={busy} onPress={onOpen} />;
      case "retry":
        return (
          <View accessibilityRole="alert">
            <UnlockRow title={t("access_unavailable_title")} flush>
              <UnlockCaption>{t("access_unavailable_detail")}</UnlockCaption>
              <Button label={t("access_retry")} variant="secondary" loading={busy} onPress={onRetry} />
            </UnlockRow>
          </View>
        );
      case "notice":
        return (
          <AppText variant="body" tone="secondary" style={styles.semibold}>
            {view.message}
          </AppText>
        );
      case "choice":
        if (confirming) {
          return (
            <UnlockConfirm
              title={t("access_coin_title", { cost })}
              lead={t("access_confirm_lead")}
              from={String(balance)}
              to={t("access_coin_amount", { amount: balance - cost })}
              note={t("access_confirm_note", { days, limit })}
              confirmLabel={opening ?? t("access_confirm")}
              cancelLabel={t("access_cancel")}
              busy={busy}
              onConfirm={onOpen}
              onCancel={onCancel}
            />
          );
        }
        if (!view.coin) return null;
        return (
          <>
            <AppText style={[styles.choose, { color: palette.main }]} accessibilityRole="header">
              {t("access_choose")}
            </AppText>
            <UnlockRow
              title={view.coin === "limit" ? t("access_limit_title") : t("access_coin_title", { cost })}
              icon={<CoinsGlyph color={palette.ctaPlayBg} size={22} />}
              aside={
                view.coin === "ready"
                  ? t("access_balance", { balance })
                  : view.coin === "short"
                    ? `${balance}/${cost}`
                    : undefined
              }
            >
              {view.coin === "short" ? (
                <ProgressLine label={t("access_coin_progress")} value={balance} max={cost} />
              ) : (
                <UnlockPips
                  limit={limit}
                  remaining={remaining}
                  label={t("access_allowance_label", { days, limit, remaining })}
                  text={t("access_allowance", { days, limit })}
                />
              )}
              {view.coin === "ready" ? (
                <UnlockCaption>{t("access_coin_ready", { remaining })}</UnlockCaption>
              ) : view.coin === "short" ? (
                <UnlockCaption>{t("access_coin_short", { missing: view.missing })}</UnlockCaption>
              ) : offer.nextAvailableAt ? (
                <UnlockCaption>
                  {t("access_next_available", { date: formatRecapInstant(offer.nextAvailableAt, locale) })}
                </UnlockCaption>
              ) : null}
              {view.lead === "coin" ? (
                <Button label={t("access_coin", { cost })} loading={busy} onPress={onOpen} />
              ) : null}
            </UnlockRow>
          </>
        );
    }
  })();

  const footer =
    view.kind === "notice"
      ? null
      : view.kind === "gift"
        ? t("access_gift_saved")
        : view.kind === "member"
          ? t("access_member_saved")
          : view.kind === "retry"
            ? t("access_archive_waiting")
            : t("access_saved_detail");

  return (
    <View style={[cardShadow, { backgroundColor: palette.surface, borderRadius: radii.card }]}>
      <View
        style={[
          styles.cover,
          { borderTopLeftRadius: radii.card, borderTopRightRadius: radii.card },
        ]}
      >
        <Image source={recapArt.decor.graphics} style={styles.graphics} contentFit="contain" />
        <AppText accessibilityRole="header" style={styles.eyebrow}>
          {t("access_eyebrow")}
        </AppText>
        <View style={styles.teaser}>
          <AppText tabularNums style={styles.teaserLine}>
            {t("access_days", { count: offer.teaser.activeDays })}
          </AppText>
          {offer.teaser.focusMinutes > 0 ? (
            <AppText tabularNums style={styles.teaserLine}>
              {t("access_minutes", { count: offer.teaser.focusMinutes })}
            </AppText>
          ) : null}
        </View>
        {/* Wraps before Puhu instead of running under it. */}
        <AppText style={[styles.range, { paddingRight: member ? 128 : 112 }]}>
          {formatRecapRange(offer.weekStart, offer.endDate, locale)}
          {offer.teaser.topSubject
            ? ` · ${t("access_top_subject", { subject: offer.teaser.topSubject })}`
            : ""}
        </AppText>
        <Image
          source={puhu}
          accessible={false}
          contentFit="contain"
          style={member ? styles.puhuMember : styles.puhu}
        />
      </View>

      <View style={styles.body}>
        <AppText variant="body" style={[styles.bold, styles.gap]}>
          {t("access_bundle")}
        </AppText>
        {view.kind === "gift" || view.kind === "choice" ? (
          <AppText variant="body" style={[styles.bold, styles.gap]}>
            {t("access_intro")}
          </AppText>
        ) : null}
        {error ? (
          <AppText accessibilityRole="alert" variant="caption" tone="danger" style={styles.gap}>
            {error}
          </AppText>
        ) : null}
        {body}
        {footer ? (
          <AppText variant="caption" tone="secondary" style={styles.footer}>
            {footer}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    height: 212,
    overflow: "hidden",
    padding: 20,
    backgroundColor: RECAP.coral,
  },
  graphics: {
    position: "absolute",
    right: -54,
    top: -26,
    width: 230,
    height: 177,
    opacity: 0.9,
  },
  eyebrow: {
    color: RECAP.ink,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 0.88,
  },
  teaser: {
    marginTop: 16,
  },
  teaserLine: {
    color: RECAP.ink,
    fontSize: 40,
    lineHeight: 41,
    fontWeight: "900",
  },
  range: {
    marginTop: 12,
    color: RECAP.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
  puhu: {
    position: "absolute",
    right: 10,
    bottom: -8,
    width: 112,
    height: 112,
  },
  puhuMember: {
    position: "absolute",
    right: -4,
    bottom: -6,
    width: 150,
    height: 150,
  },
  body: {
    padding: 20,
  },
  gap: {
    marginBottom: 16,
  },
  bold: {
    fontWeight: "700",
  },
  semibold: {
    fontWeight: "600",
  },
  choose: {
    marginBottom: 12,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  footer: {
    marginTop: 14,
    textAlign: "center",
  },
});
