import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { http } from "@mentor/api-client";
import type { EconomyLedgerEntryView, EconomyUseView } from "@mentor/types";
import { fetchDailyQuests, fetchEconomyBalance, fetchEconomyUses } from "../../lib/coaching-api.js";
import { useIsPremium } from "../../lib/premium.js";
import { useAppAvailability } from "../../providers/availability-provider.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { FormSheet } from "../panel/primitives.js";
import { QuestsSheet, type QuestDestination } from "../panel/quests-sheet.js";
import { AppText, Button, Skeleton } from "../ui/index.js";
import { FriendInviteCard } from "./friend-invite-card.js";
import { SettingsCard, SettingsRow } from "./settings-row.js";

type Sheet = "balance" | "quests" | "invite" | null;

/** The web's `EconomySection` ("Kazanımlar"): three rows, each opening its sheet. Students only; hidden with the economy flag. */
export function EconomyCard() {
  const t = useTranslations("settings");
  const router = useRouter();
  const { availability } = useAppAvailability();
  const [sheet, setSheet] = useState<Sheet>(null);
  const questsQuery = useQuery({ queryKey: ["economy", "quests"], queryFn: fetchDailyQuests, enabled: availability.economy });
  if (!availability.economy) return null;

  const goFromQuest = (destination: QuestDestination) => {
    setSheet(destination === "invite" ? "invite" : null);
    if (destination === "plan") router.replace("/plan" as never);
    else if (destination === "study-session") router.push("/(app)/study-session" as never);
  };

  return (
    <>
      <SettingsCard title={t("earned_title")}>
        <SettingsRow label={t("earned_balance")} onPress={() => setSheet("balance")} />
        <SettingsRow label={t("earned_quests")} onPress={() => setSheet("quests")} />
        <SettingsRow label={t("earned_invite")} onPress={() => setSheet("invite")} />
      </SettingsCard>
      {sheet === "balance" ? <BalanceSheet onClose={() => setSheet(null)} /> : null}
      <QuestsSheet visible={sheet === "quests"} quests={questsQuery.data ?? []} onClose={() => setSheet(null)} onGo={goFromQuest} />
      {sheet === "invite" ? (
        <FormSheet visible title={t("earned_invite")} closeLabel={t("earned_close")} onClose={() => setSheet(null)}>
          <FriendInviteCard />
        </FormSheet>
      ) : null}
    </>
  );
}

function BalanceSheet({ onClose }: { onClose: () => void }) {
  const t = useTranslations("settings");
  const { locale } = useLocale();
  const { palette, space } = useThemeTokens();
  const balanceQuery = useQuery({ queryKey: ["economy", "balance"], queryFn: fetchEconomyBalance });
  const ledgerQuery = useQuery({
    queryKey: ["economy", "ledger"],
    queryFn: async () => (await http<EconomyLedgerEntryView[]>("/v1/economy/ledger?page=1&pageSize=20")) as EconomyLedgerEntryView[],
  });
  const balance = balanceQuery.data;
  const date = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" });

  return (
    <FormSheet visible title={t("earned_balance")} closeLabel={t("earned_close")} onClose={onClose}>
      <View style={{ gap: space.lg }}>
        <AppText variant="caption" tone="secondary">{t("balance_subtitle")}</AppText>
        {balanceQuery.isLoading ? <AppText variant="caption" tone="secondary">{t("balance_loading")}</AppText>
          : !balance ? <AppText variant="caption" tone="danger" accessibilityRole="alert">{t("balance_error")}</AppText> : (
            <View style={{ flexDirection: "row", gap: space.lg }}>
              <Stat label={t("balance_xp")} value={balance.xp} />
              <Stat label={t("balance_coin")} value={balance.coinConfirmed}
                note={balance.coinPending > 0 ? t("balance_pending", { count: balance.coinPending }) : undefined} />
            </View>
          )}
        <UsesSection onNavigate={onClose} />
        <View style={{ gap: space.sm, borderTopWidth: 1, borderColor: palette.border, paddingTop: space.md }}>
          <AppText variant="body" style={{ fontWeight: "700" }}>{t("ledger_title")}</AppText>
          {ledgerQuery.isLoading ? <AppText variant="caption" tone="secondary">{t("ledger_loading")}</AppText>
            : ledgerQuery.isError ? <AppText variant="caption" tone="secondary">{t("ledger_error")}</AppText>
            : !ledgerQuery.data?.length ? <AppText variant="caption" tone="secondary">{t("ledger_empty")}</AppText>
            : ledgerQuery.data.map((entry) => (
              <View key={entry.id} style={{ flexDirection: "row", justifyContent: "space-between", gap: space.md, paddingVertical: space.xs }}>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <AppText variant="body" style={{ fontWeight: "700" }}>{entry.title}</AppText>
                  <AppText variant="caption" tone="secondary">{entry.description}</AppText>
                  <AppText variant="caption" tone="secondary">{date.format(new Date(entry.createdAt))}</AppText>
                </View>
                <AppText variant="body" style={{ fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                  {`${entry.amount > 0 ? "+" : ""}${entry.amount} ${entry.unit === "COIN" ? "Coin" : "XP"}`}
                </AppText>
              </View>
            ))}
        </View>
      </View>
    </FormSheet>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <AppText variant="caption" tone="secondary">{label}</AppText>
      <AppText variant="title" style={{ fontVariant: ["tabular-nums"] }}>{value}</AppText>
      {note ? <AppText variant="caption" tone="secondary">{note}</AppText> : null}
    </View>
  );
}

/** The web's `EconomyUsesCard`. "Premium'a dahil" shows only to a Premium member (no Premium sales on mobile). */
function UsesSection({ onNavigate }: { onNavigate: () => void }) {
  const t = useTranslations("settings");
  const router = useRouter();
  const premium = useIsPremium();
  const { palette, radii, space } = useThemeTokens();
  const usesQuery = useQuery({ queryKey: ["economy", "uses"], queryFn: fetchEconomyUses });
  const view = usesQuery.data;

  // The sheet sits in a Modal on a tab that stays mounted: close it before leaving.
  const open = (item: EconomyUseView) => {
    onNavigate();
    if (item.id === "NOTEBOOK_SLOT") router.push("/(app)/notebooks" as never);
    else router.replace((item.id === "PLAN_PREVIEW" ? "/plan" : item.id === "DEEP_ANALYSIS" ? "/analysis" : "/coach") as never);
  };

  return (
    <View style={{ gap: space.sm, borderTopWidth: 1, borderColor: palette.border, paddingTop: space.md }}>
      <AppText variant="body" style={{ fontWeight: "700" }}>{t("uses_title")}</AppText>
      <AppText variant="caption" tone="secondary">{t("uses_xp_note")}</AppText>
      {usesQuery.isLoading ? [0, 1].map((id) => <Skeleton key={id} width="100%" height={120} />)
        : !view ? <AppText variant="caption" tone="secondary" accessibilityRole="alert">{t("uses_error")}</AppText> : (
          <>
            <AppText variant="body" style={{ fontWeight: "700" }}>{t("uses_balance", { coin: view.coinConfirmed })}</AppText>
            {view.items.map((item) => (
              <View key={item.id} style={{ gap: space.xs, padding: space.md, borderWidth: 1, borderColor: palette.border, borderRadius: radii.card }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: space.sm }}>
                  <AppText variant="body" style={{ fontWeight: "700", flexShrink: 1 }}>{t(`uses_${item.id}_title` as "uses_COACH_CHAT_title")}</AppText>
                  {item.premiumIncluded ? (premium ? <AppText variant="caption" tone="secondary">{t("uses_premium")}</AppText> : null)
                    : item.cost !== null ? <AppText variant="body" style={{ fontWeight: "700" }}>{t("uses_cost", { cost: item.cost })}</AppText> : null}
                </View>
                <AppText variant="caption" tone="secondary">{t(`uses_${item.id}_description` as "uses_COACH_CHAT_description")}</AppText>
                <AppText variant="caption" style={{ fontWeight: "700" }}>{t(`uses_status_${item.status}` as "uses_status_AVAILABLE")}</AppText>
                {item.dailyRemaining !== undefined ? <AppText variant="caption" tone="secondary">{t("uses_daily", { count: item.dailyRemaining })}</AppText> : null}
                {item.slotsOwned !== undefined && item.slotLimit !== undefined
                  ? <AppText variant="caption" tone="secondary">{t("uses_slots", { used: item.slotsOwned, max: item.slotLimit })}</AppText> : null}
                {item.canOpen ? <Button label={t(`uses_${item.id}_action` as "uses_COACH_CHAT_action")} variant="secondary" onPress={() => open(item)} /> : null}
              </View>
            ))}
            <AppText variant="caption" tone="secondary">{t("uses_recheck")}</AppText>
          </>
        )}
    </View>
  );
}
