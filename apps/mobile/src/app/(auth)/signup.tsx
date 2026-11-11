import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  hasCompletedOnboarding,
  isWaitlistOn,
  opensWaitlist,
  postAuthDestination,
} from "@mentor/core";
import { ApiClientError } from "@mentor/api-client";
import { signupSchema } from "@mentor/validation";
import { Button, Card, Chip, TextField, AppText } from "../../components/ui/index.js";
import { haptics } from "../../lib/haptics.js";
import { useAppAvailability } from "../../providers/availability-provider.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";

export default function SignupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const insets = useSafeAreaInsets();
  const { signup } = useAuth();
  const { availability } = useAppAvailability();
  const { palette, space, radii } = useThemeTokens();
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");

  const [intent, setIntent] = useState<"STUDENT" | "COACH">(
    params.role === "coach" ? "COACH" : "STUDENT",
  );
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (isWaitlistOn(availability)) {
    const target =
      intent === "COACH" ? "/(auth)/waitlist?role=coach" : "/(auth)/waitlist";
    return <Redirect href={target as never} />;
  }

  const isCoachIntent = intent === "COACH";

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (!kvkkAccepted) {
      haptics.error();
      setErrorMessage(t("kvkk_error"));
      return;
    }
    if (!termsAccepted) {
      haptics.error();
      setErrorMessage(t("terms_error"));
      return;
    }

    const parsed = signupSchema.safeParse({
      email: email.trim(),
      password,
      displayName: displayName.trim(),
      kvkkAccepted: true,
      termsAccepted: true,
      ...(isCoachIntent ? { intent: "COACH" as const } : {}),
    });

    if (!parsed.success) {
      haptics.error();
      setErrorMessage(t("invalid_form"));
      return;
    }

    setSubmitting(true);
    try {
      const user = await signup(parsed.data);
      haptics.success();
      if (!hasCompletedOnboarding(user)) {
        router.replace("/(onboarding)" as never);
        return;
      }
      const destination = postAuthDestination(user, null, availability);
      router.replace(destination as never);
    } catch (err) {
      haptics.error();
      if (err instanceof ApiClientError && opensWaitlist(err.body.code)) {
        router.replace(
          (isCoachIntent
            ? "/(auth)/waitlist?role=coach"
            : "/(auth)/waitlist") as never,
        );
        return;
      }
      setErrorMessage(
        err instanceof ApiClientError ? err.message : tCommon("error_body"),
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
      <View style={{ gap: space.xs }}>
        <View style={styles.intentRow}>
          <Chip
            label={t("coach_switch_student")}
            selected={!isCoachIntent}
            onPress={() => setIntent("STUDENT")}
          />
          <Chip
            label={t("signup_title_coach")}
            selected={isCoachIntent}
            onPress={() => setIntent("COACH")}
          />
        </View>
        <AppText variant="title">
          {isCoachIntent ? t("signup_title_coach") : t("signup_title")}
        </AppText>
        <AppText variant="body" tone="secondary">
          {isCoachIntent ? t("signup_coach_intro") : t("login_subtitle")}
        </AppText>
      </View>

      <Card style={{ gap: space.md }}>
        <TextField
          label={t("name_label")}
          placeholder={t("name_placeholder")}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
        />
        <TextField
          label={t("email_label")}
          placeholder={t("email_placeholder")}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextField
          label={t("password_label")}
          placeholder={t("password_placeholder")}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: kvkkAccepted }}
          onPress={() => {
            haptics.selection();
            setKvkkAccepted((prev) => !prev);
          }}
          style={styles.checkRow}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderRadius: radii.inner,
                borderColor: kvkkAccepted ? palette.ctaPlayBg : palette.border,
                backgroundColor: kvkkAccepted
                  ? palette.ctaPlayBg
                  : palette.surface,
              },
            ]}
          >
            {kvkkAccepted ? (
              <AppText variant="caption" tone="ctaInk">
                ✓
              </AppText>
            ) : null}
          </View>
          <AppText variant="caption" style={{ flex: 1 }}>
            {t("kvkk_label")}
          </AppText>
        </Pressable>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: termsAccepted }}
          onPress={() => {
            haptics.selection();
            setTermsAccepted((prev) => !prev);
          }}
          style={styles.checkRow}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderRadius: radii.inner,
                borderColor: termsAccepted
                  ? palette.ctaPlayBg
                  : palette.border,
                backgroundColor: termsAccepted
                  ? palette.ctaPlayBg
                  : palette.surface,
              },
            ]}
          >
            {termsAccepted ? (
              <AppText variant="caption" tone="ctaInk">
                ✓
              </AppText>
            ) : null}
          </View>
          <AppText variant="caption" style={{ flex: 1 }}>
            {t("terms_label")}
          </AppText>
        </Pressable>

        {errorMessage ? (
          <AppText variant="caption" tone="danger">
            {errorMessage}
          </AppText>
        ) : null}

        <Button
          label={t("signup_submit")}
          loading={submitting}
          onPress={() => {
            void handleSubmit();
          }}
          variant="primary"
        />
      </Card>

      <View style={styles.footerRow}>
        <AppText variant="caption" tone="secondary">
          {t("login_prompt")}{" "}
        </AppText>
        <Pressable
          accessibilityRole="link"
          hitSlop={8}
          onPress={() => router.push("/(auth)/login" as never)}
        >
          <AppText variant="caption" tone="accent">
            {t("login_link")}
          </AppText>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  intentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 36,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
});
