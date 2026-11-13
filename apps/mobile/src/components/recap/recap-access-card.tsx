import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { recapAccessView } from "@mentor/core";
import type { WeeklyRecapOfferDto } from "@mentor/types";
import { art, careerArt, recapArt } from "../../lib/art.js";
import { cardShadow } from "../../lib/layout.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { CoinsGlyph } from "../navigation/app-header.js";
import { PLAY_RADIUS, ProgressLine } from "../panel/primitives.js";
import { Button } from "../ui/index.js";
import { AppText } from "../ui/text.js";
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
          <Row title={t("access_gift_title")} flush>
            <Caption>{t("access_gift_detail")}</Caption>
            <Button label={opening ?? t("access_earned")} loading={busy} onPress={onOpen} />
          </Row>
        );
      case "member":
        return (
          <Row title={t("access_member_title")} flush>
            <Caption>{t("access_member_detail")}</Caption>
            <Button label={opening ?? t("access_open")} loading={busy} onPress={onOpen} />
          </Row>
        );
      case "owned":
        return <Button label={t("access_replay")} loading={busy} onPress={onOpen} />;
      case "retry":
        return (
          <View accessibilityRole="alert">
            <Row title={t("access_unavailable_title")} flush>
              <Caption>{t("access_unavailable_detail")}</Caption>
              <Button label={t("access_retry")} variant="secondary" loading={busy} onPress={onRetry} />
            </Row>
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
            <View style={[styles.row, { borderTopColor: palette.playLine }]}>
              <View style={styles.rowHead}>
                <CoinsGlyph color={palette.ctaPlayBg} size={22} />
                <AppText style={[styles.rowTitle, { color: palette.main }]}>
                  {t("access_coin_title", { cost })}
                </AppText>
              </View>
              <View style={[styles.confirm, { backgroundColor: palette.playSelected }]}>
                <AppText variant="caption" style={{ color: palette.playSelectedInk, fontWeight: "800" }}>
                  {t("access_confirm_lead")}
                </AppText>
                <View style={styles.fromTo}>
                  <AppText tabularNums tone="secondary" style={styles.from}>
                    {String(balance)}
                  </AppText>
                  <AppText style={{ color: palette.playSelectedInk, fontSize: 18 }}>→</AppText>
                  <AppText tabularNums style={styles.to}>
                    {t("access_coin_amount", { amount: balance - cost })}
                  </AppText>
                </View>
                <Caption tone="main">{t("access_confirm_note", { days, limit })}</Caption>
                <View style={styles.confirmActions}>
                  <Button label={opening ?? t("access_confirm")} loading={busy} onPress={onOpen} />
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={onCancel}
                    style={styles.quietLink}
                  >
                    <AppText variant="caption" tone="secondary" style={styles.bold}>
                      {t("access_cancel")}
                    </AppText>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }
        if (!view.coin) return null;
        return (
          <>
            <AppText style={[styles.choose, { color: palette.main }]} accessibilityRole="header">
              {t("access_choose")}
            </AppText>
            <Row
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
                <Pips
                  limit={limit}
                  remaining={remaining}
                  label={t("access_allowance_label", { days, limit, remaining })}
                  text={t("access_allowance", { days, limit })}
                />
              )}
              {view.coin === "ready" ? (
                <Caption>{t("access_coin_ready", { remaining })}</Caption>
              ) : view.coin === "short" ? (
                <Caption>{t("access_coin_short", { missing: view.missing })}</Caption>
              ) : offer.nextAvailableAt ? (
                <Caption>
                  {t("access_next_available", { date: formatRecapInstant(offer.nextAvailableAt, locale) })}
                </Caption>
              ) : null}
              {view.lead === "coin" ? (
                <Button label={t("access_coin", { cost })} loading={busy} onPress={onOpen} />
              ) : null}
            </Row>
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

/** One "açma" row (the web's `UnlockRow`): hairline above, icon, title, a count on the right. */
function Row({
  title,
  icon,
  aside,
  flush = false,
  children,
}: {
  title: string;
  icon?: ReactNode;
  aside?: string;
  flush?: boolean;
  children?: ReactNode;
}) {
  const { palette } = useThemeTokens();
  return (
    <View style={[flush ? styles.rowFlush : styles.row, !flush && { borderTopColor: palette.playLine }]}>
      <View style={styles.rowHead}>
        {icon}
        <AppText accessibilityRole="header" style={[styles.rowTitle, { color: palette.main }]}>
          {title}
        </AppText>
        {aside ? (
          <AppText variant="caption" tone="secondary" tabularNums style={styles.bold}>
            {aside}
          </AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Caption({ children, tone = "secondary" }: { children: ReactNode; tone?: "secondary" | "main" }) {
  return (
    <AppText variant="caption" tone={tone}>
      {children}
    </AppText>
  );
}

/** The rolling allowance: filled pips are uses still available. */
function Pips({ limit, remaining, label, text }: { limit: number; remaining: number; label: string; text: string }) {
  const { palette } = useThemeTokens();
  return (
    <View accessible accessibilityLabel={label} style={styles.pips}>
      {Array.from({ length: limit }, (_, i) => (
        <View
          key={i}
          style={[
            styles.pip,
            i < remaining
              ? { backgroundColor: palette.ctaPlayBg }
              : {
                  backgroundColor: palette.playTrack,
                  borderWidth: 1.5,
                  borderStyle: "dashed",
                  borderColor: palette.secondary,
                  opacity: 0.6,
                },
          ]}
        />
      ))}
      <AppText variant="caption" style={styles.bold}>
        {text}
      </AppText>
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
  row: {
    gap: 10,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  rowFlush: {
    gap: 10,
    paddingBottom: 4,
  },
  rowHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
  },
  pips: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pip: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  confirm: {
    marginTop: 12,
    padding: 16,
    borderRadius: PLAY_RADIUS,
  },
  fromTo: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  from: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },
  to: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
  },
  confirmActions: {
    marginTop: 14,
    gap: 4,
  },
  quietLink: {
    minHeight: 44,
    alignSelf: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  footer: {
    marginTop: 14,
    textAlign: "center",
  },
});
