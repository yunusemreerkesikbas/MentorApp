import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiClientError } from "@mentor/api-client";
import { art } from "../../lib/art.js";
import {
  acceptBuddyRequest,
  deleteBuddyRequest,
  endBuddy,
  getBuddy,
  getBuddySuggestions,
  nudgeBuddy,
  sendBuddyRequest,
} from "../../lib/buddy-api.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useToast } from "../../providers/toast-provider.js";
import { CommunityAvatar } from "../community/community-avatar.js";
import { AppText, Button, ConfirmDialog, Skeleton } from "../ui/index.js";
import { StageCard, useStageLook } from "./session-stage.js";

const BUDDY_KEY = ["buddy"] as const;

/** The web's `SessionBuddyCard`: the study buddy, a pending request, or who you sat with. */
export function SessionBuddyCard() {
  const t = useTranslations("session");
  const look = useStageLook();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const buddy = useQuery({
    queryKey: BUDDY_KEY,
    queryFn: getBuddy,
    // Live presence of an active partner, as the web polls it.
    refetchInterval: (query) => (query.state.data?.active ? 60_000 : false),
  });

  // A failed first load degrades silently (the card just disappears); a failed refetch keeps what was shown.
  if (buddy.isError && !buddy.data) return null;
  if (buddy.isPending) {
    return (
      <StageCard title={t("buddy_title")}>
        <View style={styles.row}>
          <Skeleton width={44} height={44} borderRadius={22} />
          <View style={{ gap: 6, flex: 1 }}>
            <Skeleton width={112} height={16} />
            <Skeleton width={80} height={12} />
          </View>
        </View>
      </StageCard>
    );
  }

  const run = async (action: () => Promise<void>, success?: string) => {
    setBusy(true);
    try {
      await action();
      if (success) {
        haptics.success();
        toast.show(success);
      }
      await queryClient.invalidateQueries({ queryKey: BUDDY_KEY });
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.body.message : t("buddy_action_error_title"));
    } finally {
      setBusy(false);
    }
  };

  const { active, outgoing, incoming } = buddy.data;
  const name = { color: look.ink, fontWeight: "800" } as const;
  const soft = { color: look.inkSoft, fontWeight: "600" } as const;

  return (
    <StageCard title={t("buddy_title")}>
      {active ? (
        <>
          <View style={styles.row}>
            <CommunityAvatar name={active.partner.displayName} avatarUrl={active.partner.avatarUrl} size={44} />
            <View style={styles.grow}>
              <AppText numberOfLines={1} style={name}>{active.partner.displayName}</AppText>
              {active.partnerStudyingNow ? (
                <View style={styles.live}>
                  <View style={[styles.dot, { backgroundColor: look.live }]} />
                  <AppText variant="caption" style={{ color: look.ink, fontWeight: "800" }}>{t("buddy_studying_now")}</AppText>
                </View>
              ) : (
                <AppText variant="caption" style={soft}>
                  {t("buddy_active_stats", { minutes: active.focusMinutesToday, days: active.currentStreak })}
                </AppText>
              )}
            </View>
            <Button label={t("buddy_nudge")} variant="secondary" disabled={busy || !active.canNudge}
              onPress={() => void run(nudgeBuddy, t("buddy_nudge_sent_message", { name: active.partner.displayName }))} />
          </View>
          <QuietLink label={t("buddy_end")} disabled={busy} onPress={() => setConfirmEnd(true)} />
          <ConfirmDialog visible={confirmEnd} destructive
            title={t("buddy_end_confirm_title")}
            message={t("buddy_end_confirm_body", { name: active.partner.displayName })}
            confirmLabel={t("buddy_end_confirm_action")} cancelLabel={t("goal_cancel")}
            onCancel={() => setConfirmEnd(false)}
            onConfirm={() => { setConfirmEnd(false); void run(endBuddy); }} />
        </>
      ) : incoming.length > 0 || outgoing ? (
        <View style={{ gap: 16 }}>
          {incoming.map((req) => (
            <View key={req.id} style={{ gap: 8 }}>
              <View style={styles.row}>
                <CommunityAvatar name={req.partner.displayName} avatarUrl={req.partner.avatarUrl} size={40} />
                <AppText style={[styles.grow, soft]}>
                  <AppText style={name}>{req.partner.displayName}</AppText> {t("buddy_incoming_suffix")}
                </AppText>
              </View>
              <View style={[styles.row, { paddingLeft: 52 }]}>
                <Button label={t("buddy_accept")} variant="secondary" disabled={busy}
                  onPress={() => void run(() => acceptBuddyRequest(req.id))} />
                <QuietLink label={t("buddy_decline")} disabled={busy} onPress={() => void run(() => deleteBuddyRequest(req.id))} />
              </View>
            </View>
          ))}
          {outgoing ? (
            <View style={styles.row}>
              <CommunityAvatar name={outgoing.partner.displayName} avatarUrl={outgoing.partner.avatarUrl} size={40} />
              <View style={styles.grow}>
                <AppText numberOfLines={1} style={name}>{outgoing.partner.displayName}</AppText>
                <AppText variant="caption" style={soft}>{t("buddy_outgoing_waiting")}</AppText>
              </View>
              <QuietLink label={t("buddy_cancel")} disabled={busy} onPress={() => void run(() => deleteBuddyRequest(outgoing.id))} />
            </View>
          ) : null}
        </View>
      ) : (
        <Suggestions busy={busy} onRequest={(username) => void run(() => sendBuddyRequest(username))} />
      )}
    </StageCard>
  );
}

function Suggestions({ busy, onRequest }: { busy: boolean; onRequest: (username: string) => void }) {
  const t = useTranslations("session");
  const look = useStageLook();
  const suggestions = useQuery({ queryKey: ["buddy", "suggestions"], queryFn: getBuddySuggestions });

  if (suggestions.isPending) return <Skeleton width="100%" height={44} />;
  // A failed load is not "no suggestions": say so and let the student try again.
  if (suggestions.isError && !suggestions.data) {
    return (
      <View style={styles.row}>
        <AppText style={[styles.grow, { color: look.inkSoft, fontWeight: "600" }]}>{t("buddy_action_error_title")}</AppText>
        <QuietLink label={t("retry")} disabled={suggestions.isFetching} onPress={() => void suggestions.refetch()} />
      </View>
    );
  }
  const list = suggestions.data ?? [];
  if (list.length === 0) {
    return (
      <View style={styles.row}>
        <Image source={art.puhuEncouraging} style={{ width: 56, height: 56 }} contentFit="contain" accessible={false} />
        <AppText style={[styles.grow, { color: look.inkSoft, fontWeight: "600" }]}>{t("buddy_empty_hint")}</AppText>
      </View>
    );
  }
  return (
    <View>
      <AppText variant="caption" style={{ color: look.inkSoft, fontWeight: "600" }}>{t("buddy_suggest_title")}</AppText>
      {list.map((user, index) => (
        <View key={user.userId} style={[styles.row, styles.suggestion, index > 0 && { borderTopWidth: 1, borderTopColor: look.glassBorder }]}>
          <CommunityAvatar name={user.displayName} avatarUrl={user.avatarUrl} size={36} />
          <View style={styles.grow}>
            <AppText numberOfLines={1} style={{ color: look.ink, fontWeight: "800" }}>{user.displayName}</AppText>
            <AppText variant="caption" numberOfLines={1} style={{ color: look.inkSoft, fontWeight: "600" }}>
              {t("buddy_together_count", { count: user.sessionsTogether })}
            </AppText>
          </View>
          <Pressable accessibilityRole="button" disabled={busy || !user.username}
            onPress={() => user.username && onRequest(user.username)} style={styles.link}>
            <AppText style={{ color: look.scenic ? look.ink : look.selectedInk, fontWeight: "800" }}>{t("buddy_suggest_action")}</AppText>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function QuietLink({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  const look = useStageLook();
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={styles.link}>
      <AppText style={{ color: look.inkSoft, fontWeight: "700" }}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  grow: { flex: 1, minWidth: 0 },
  live: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  suggestion: { paddingVertical: 10 },
  link: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
});
