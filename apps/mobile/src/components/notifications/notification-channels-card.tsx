import { useEffect, useState } from "react";
import { StyleSheet, Switch, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiClientError } from "@mentor/api-client";
import type { NotificationPreferencesDto } from "@mentor/types";
import { haptics } from "../../lib/haptics.js";
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from "../../lib/notifications-api.js";
import {
  registerDeviceForPushNotifications,
  unregisterCachedPushToken,
} from "../../lib/push-notifications.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { PanelCard } from "../panel/primitives.js";
import { AppText, Skeleton } from "../ui/index.js";

export function NotificationChannelsCard() {
  const queryClient = useQueryClient();
  const { palette, space } = useThemeTokens();
  const { locale } = useLocale();
  const t = useTranslations("notifications");

  const prefsQuery = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: fetchNotificationPreferences,
  });

  const [localPrefs, setLocalPrefs] = useState<NotificationPreferencesDto | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pushStatusNote, setPushStatusNote] = useState<string | null>(null);

  useEffect(() => {
    if (prefsQuery.data) {
      setLocalPrefs(prefsQuery.data);
    }
  }, [prefsQuery.data]);

  const syncNativePushOnEnable = async () => {
    const result = await registerDeviceForPushNotifications({ requestPermission: true });
    if (result.status === "denied") {
      setPushStatusNote(t("pref_push_permission_denied"));
    } else if (
      result.status === "expo_go_unsupported" ||
      result.status === "missing_project_id"
    ) {
      setPushStatusNote(t("pref_push_dev_build_required"));
    } else if (result.status === "error") {
      setPushStatusNote(t("pref_push_register_error"));
    } else {
      setPushStatusNote(null);
    }
  };

  const prefMutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (updated, variables) => {
      haptics.selection();
      setErrorMessage(null);
      setLocalPrefs(updated);
      queryClient.setQueryData(["notifications", "preferences"], updated);
      if (variables.pushEnabled === true) {
        void syncNativePushOnEnable();
      } else if (variables.pushEnabled === false) {
        setPushStatusNote(null);
        void unregisterCachedPushToken();
      }
    },
    onError: (err) => {
      haptics.error();
      if (prefsQuery.data) {
        setLocalPrefs(prefsQuery.data);
      }
      setErrorMessage(
        err instanceof ApiClientError ? err.message : t("prefs_save_error"),
      );
    },
  });

  const title = t("prefs_title").toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US");

  if (prefsQuery.isLoading && !localPrefs) {
    return (
      <PanelCard style={styles.card}>
        <Skeleton width={136} height={14} />
        <Skeleton width="100%" height={44} />
        <Skeleton width="100%" height={44} />
        <Skeleton width="100%" height={44} />
      </PanelCard>
    );
  }

  if (prefsQuery.isError && !localPrefs) {
    return (
      <PanelCard style={styles.card}>
        <AppText style={[styles.eyebrow, { color: palette.secondary }]}>{title}</AppText>
        <AppText variant="caption" tone="danger">
          {t("prefs_load_error")}
        </AppText>
      </PanelCard>
    );
  }

  if (!localPrefs) return null;

  const togglePref = (
    key: keyof NotificationPreferencesDto,
    nextValue: boolean,
  ) => {
    setErrorMessage(null);
    setLocalPrefs((cur) => (cur ? { ...cur, [key]: nextValue } : cur));
    prefMutation.mutate({ [key]: nextValue });
  };

  return (
    <PanelCard style={[styles.card, { padding: space.md }]}>
      <View style={styles.header}>
        <AppText style={[styles.eyebrow, { color: palette.secondary }]}>{title}</AppText>
      </View>

      {errorMessage ? (
        <AppText variant="caption" tone="danger" style={styles.errorText}>
          {errorMessage}
        </AppText>
      ) : null}

      {pushStatusNote ? (
        <AppText variant="caption" tone="secondary" style={styles.errorText}>
          {pushStatusNote}
        </AppText>
      ) : null}

      <View style={styles.list}>
        <ChannelToggleRow
          label={t("pref_email")}
          description={t("pref_email_desc")}
          value={localPrefs.emailEnabled}
          disabled={prefMutation.isPending}
          onChange={(next) => togglePref("emailEnabled", next)}
        />
        <ChannelToggleRow
          label={t("pref_push")}
          description={t("pref_push_desc")}
          value={localPrefs.pushEnabled}
          disabled={prefMutation.isPending}
          onChange={(next) => togglePref("pushEnabled", next)}
        />
        <ChannelToggleRow
          label={t("pref_campaigns")}
          description={t("pref_campaigns_desc")}
          value={localPrefs.campaignsEnabled}
          disabled={prefMutation.isPending}
          onChange={(next) => togglePref("campaignsEnabled", next)}
        />
      </View>
    </PanelCard>
  );
}

function ChannelToggleRow({
  label,
  description,
  value,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  const { palette } = useThemeTokens();

  return (
    <View style={styles.row}>
      <View style={styles.labelCol}>
        <AppText style={[styles.rowLabel, { color: palette.main }]}>{label}</AppText>
        <AppText variant="caption" tone="secondary">
          {description}
        </AppText>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: palette.playTrack, true: palette.ctaPlayBg }}
        thumbColor={palette.surface}
        ios_backgroundColor={palette.playTrack}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
  },
  header: {
    paddingHorizontal: 4,
    paddingTop: 2,
    paddingBottom: 4,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  errorText: {
    paddingHorizontal: 4,
  },
  list: {
    gap: 4,
  },
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  labelCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
});
