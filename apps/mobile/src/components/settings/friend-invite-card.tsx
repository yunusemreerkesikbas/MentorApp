import { useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { normalizeInviteCode } from "@mentor/validation";
import {
  fetchInviteCard,
  redeemFriendInvite,
} from "../../lib/coaching-api.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Card, Chip, TextField } from "../ui/index.js";

export function FriendInviteCard() {
  const queryClient = useQueryClient();
  const { palette, radii, space } = useThemeTokens();
  const t = useTranslations("settings");

  const [codeInput, setCodeInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const inviteQuery = useQuery({
    queryKey: ["economy", "invite"],
    queryFn: fetchInviteCard,
  });

  const redeemMutation = useMutation({
    mutationFn: () => redeemFriendInvite(normalizeInviteCode(codeInput)),
    onSuccess: async () => {
      haptics.success();
      setCodeInput("");
      setErrorMsg(null);
      await queryClient.invalidateQueries({ queryKey: ["economy", "invite"] });
    },
    onError: (err) => {
      haptics.error();
      setErrorMsg(
        err instanceof Error ? err.message : "Davet kodu kullanılamadı.",
      );
    },
  });

  const card = inviteQuery.data;
  if (!card) {
    return null;
  }

  const handleShareCode = async () => {
    haptics.selection();
    try {
      await Share.share({
        message: `PuhuKoç davet kodum: ${card.code}`,
      });
    } catch {
      // User dismissed share sheet
    }
  };

  return (
    <Card style={{ gap: space.sm }}>
      <View style={styles.rowBetween}>
        <AppText variant="sectionHeading">{t("friend_invite_title")}</AppText>
        <Chip label={card.code} selected />
      </View>

      <AppText variant="caption" tone="secondary">
        {t("friend_invite_desc", { coin: card.rewardCoin })}
      </AppText>

      <View
        style={{
          padding: space.sm,
          borderRadius: radii.inner,
          backgroundColor: palette.surfaceAlt,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <AppText variant="caption" tone="secondary">
          {t("friend_invite_stats", {
            joined: card.joinedCount,
            converted: card.convertedCount,
          })}
        </AppText>
        <Chip
          label={t("friend_invite_share_cta")}
          onPress={() => void handleShareCode()}
        />
      </View>

      {card.redeemed ? (
        <AppText variant="caption" tone="success">
          {t("friend_invite_redeemed_by", {
            name: card.redeemed.inviterDisplayName,
          })}
        </AppText>
      ) : card.canRedeem ? (
        <View style={{ gap: space.sm }}>
          <TextField
            label={t("friend_invite_redeem_label")}
            placeholder={t("friend_invite_redeem_placeholder")}
            value={codeInput}
            onChangeText={setCodeInput}
            autoCapitalize="characters"
          />
          {errorMsg ? (
            <AppText variant="caption" tone="danger">
              {errorMsg}
            </AppText>
          ) : null}
          <Button
            label={t("friend_invite_redeem_cta")}
            variant="secondary"
            disabled={codeInput.trim().length < 6}
            loading={redeemMutation.isPending}
            onPress={() => redeemMutation.mutate()}
          />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
});
