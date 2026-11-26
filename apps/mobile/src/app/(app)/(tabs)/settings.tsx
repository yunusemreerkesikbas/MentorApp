import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { ApiClientError, usersControllerMe } from "@mentor/api-client";
import { isCoach } from "@mentor/core";
import type { AuthUser } from "@mentor/types";
import { NotificationChannelsCard } from "../../../components/notifications/notification-channels-card.js";
import { PanelCard } from "../../../components/panel/primitives.js";
import { AccountCard } from "../../../components/settings/account-card.js";
import { EconomyCard } from "../../../components/settings/economy-card.js";
import { PhoneVerificationCard } from "../../../components/settings/phone-verification-card.js";
import { ProfileEditSheet } from "../../../components/settings/profile-edit-sheet.js";
import {
  AppSupportCard, CoachScopeCard, GoogleAccountCard, LegalLinks, SocialFollowCard,
} from "../../../components/settings/settings-cards.js";
import { SettingsIdentity } from "../../../components/settings/settings-identity.js";
import { Skeleton, StateView } from "../../../components/ui/index.js";
import { tabBarClearance } from "../../../lib/layout.js";
import { useAuth } from "../../../providers/auth-provider.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";

/** The web's `/ayarlar` (`ProfileShell`) in its phone order. */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, setUserFromServer } = useAuth();
  const { palette, space } = useThemeTokens();
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [editing, setEditing] = useState(false);
  const meQuery = useQuery({
    queryKey: ["users", "me"],
    queryFn: async () => (await usersControllerMe()) as unknown as AuthUser,
  });

  useEffect(() => {
    if (meQuery.data) setUserFromServer(meQuery.data);
  }, [meQuery.data, setUserFromServer]);

  const coach = user ? isCoach(user) : false;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{
        paddingTop: space.lg,
        paddingBottom: tabBarClearance(insets.bottom),
        paddingHorizontal: space.lg,
        gap: space.xl,
      }}
    >
      {meQuery.isError && !meQuery.data && !user ? (
        <StateView tone="error" title={t("load_error")}
          body={meQuery.error instanceof ApiClientError ? meQuery.error.body.message : tCommon("error_body")}
          actionLabel={tCommon("retry")} onAction={() => void meQuery.refetch()} />
      ) : !user || (!meQuery.data && !meQuery.isError) ? (
        <SettingsSkeleton coach={coach} />
      ) : (
        <>
          <SettingsIdentity user={user} onEdit={() => setEditing(true)} />
          {coach ? <CoachScopeCard /> : null}
          <NotificationChannelsCard />
          <GoogleAccountCard />
          <PhoneVerificationCard />
          <AppSupportCard />
          <SocialFollowCard />
          {coach ? null : <EconomyCard />}
          <AccountCard user={user} />
          <LegalLinks />
          {editing ? <ProfileEditSheet user={user} onClose={() => setEditing(false)} /> : null}
        </>
      )}
    </ScrollView>
  );
}

/** Mirrors the loaded layout: centred identity, then list cards (a coach gets no Kazanımlar block). */
function SettingsSkeleton({ coach }: { coach: boolean }) {
  const { space } = useThemeTokens();
  const card = (rows: number) => (
    <PanelCard style={{ padding: space.md, gap: space.sm }}>
      <Skeleton width={112} height={12} />
      {Array.from({ length: rows }, (_, row) => <Skeleton key={row} width="100%" height={36} />)}
    </PanelCard>
  );
  return (
    <View style={{ gap: space.xl }} accessibilityRole="progressbar">
      <View style={{ alignItems: "center", gap: space.sm, paddingTop: space.sm }}>
        <Skeleton width={112} height={112} borderRadius={56} />
        <Skeleton width={224} height={36} />
        <Skeleton width={240} height={16} />
      </View>
      {card(3)}
      {card(1)}
      {card(5)}
      {coach ? null : card(3)}
      {card(6)}
    </View>
  );
}
