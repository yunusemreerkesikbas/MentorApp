import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isWaitlistEmail } from "@mentor/core";
import { ApiClientError, authControllerJoinWaitlist } from "@mentor/api-client";
import { Button, Card, Chip, TextField, AppText } from "../../components/ui/index.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";

export default function WaitlistScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const insets = useSafeAreaInsets();
  const { palette, space } = useThemeTokens();
  const t = useTranslations("waitlist");

  const [role, setRole] = useState<"student" | "coach">(
    params.role === "coach" ? "coach" : "student",
  );
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isCoachRole = role === "coach";
  const emailValid = isWaitlistEmail(email);

  const handleJoin = async () => {
    setErrorMessage(null);
    const trimmed = email.trim();
    if (!isWaitlistEmail(trimmed)) {
      haptics.error();
      setErrorMessage(t("error_invalid"));
      return;
    }

    setSubmitting(true);
    try {
      await authControllerJoinWaitlist({ email: trimmed });
      haptics.success();
      setJoined(true);
    } catch (err) {
      haptics.error();
      setErrorMessage(
        err instanceof ApiClientError ? err.message : t("error_network"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + space.xl,
          paddingBottom: insets.bottom + space.xl,
          paddingHorizontal: space.lg,
          gap: space.lg,
        },
      ]}
    >
      <View style={{ gap: space.sm }}>
        <View style={styles.chipRow}>
          <Chip
            label={t("role_student")}
            selected={!isCoachRole}
            onPress={() => setRole("student")}
          />
          <Chip
            label={t("role_coach")}
            selected={isCoachRole}
            onPress={() => setRole("coach")}
          />
        </View>
        <AppText variant="caption" tone="accent">
          {joined ? t("badge_success") : t("badge_idle")}
        </AppText>
        <AppText variant="title">
          {joined ? t("title_success") : t("title_idle")}
        </AppText>
        <AppText variant="body" tone="secondary">
          {joined ? t("body_success", { email: email.trim() }) : t("body_idle")}
        </AppText>
      </View>

      <Card style={{ gap: space.md }}>
        {joined ? (
          <View style={{ gap: space.sm }}>
            <Button
              label={t("done_cta")}
              onPress={() => router.replace("/(auth)/welcome" as never)}
              variant="primary"
            />
            <Button
              label={t("edit_cta")}
              onPress={() => setJoined(false)}
              variant="secondary"
            />
          </View>
        ) : (
          <>
            <TextField
              label={t("email_label")}
              placeholder={t("email_placeholder")}
              value={email}
              onChangeText={(val) => {
                setEmail(val);
                setErrorMessage(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              errorMessage={errorMessage}
            />
            <Button
              label={t("submit")}
              loading={submitting}
              disabled={!emailValid}
              onPress={() => {
                void handleJoin();
              }}
              variant="primary"
            />
          </>
        )}
      </Card>

      <Button
        label={t("login_cta")}
        onPress={() => router.push("/(auth)/login" as never)}
        variant="secondary"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
