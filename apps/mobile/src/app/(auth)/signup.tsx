import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
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
import { STUDENT_CORE_ONLY } from "../../lib/release-scope.js";
import { signupLegalUrl, type SignupLegalDocument } from "../../lib/signup-legal.js";
import { useAppAvailability } from "../../providers/availability-provider.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";

export default function SignupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const insets = useSafeAreaInsets();
  const { signup } = useAuth();
  const { availability } = useAppAvailability();
  const { palette, space } = useThemeTokens();
  const { locale } = useLocale();
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");

  const [intent, setIntent] = useState<"STUDENT" | "COACH">(
    !STUDENT_CORE_ONLY && params.role === "coach" ? "COACH" : "STUDENT",
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

  const openLegalDocument = async (document: SignupLegalDocument) => {
    setErrorMessage(null);
    try {
      await Linking.openURL(signupLegalUrl(document, locale));
    } catch {
      setErrorMessage(t("legal_open_error"));
    }
  };

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
      // The terms checkbox carries the age statement ("... ve en az 13 yaşındayım").
      ageEligibilityConfirmed: true,
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
        {STUDENT_CORE_ONLY ? null : (
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
        )}
        <AppText variant="title">
          {isCoachIntent ? t("signup_title_coach") : t("signup_title")}
        </AppText>
        {isCoachIntent ? (
          <AppText variant="body" tone="secondary">{t("signup_coach_intro")}</AppText>
        ) : null}
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

        <SignupConsent
          checked={kvkkAccepted}
          label={t("kvkk_label")}
          linkLabel={t("kvkk_link")}
          onToggle={() => setKvkkAccepted((prev) => !prev)}
          onOpen={() => void openLegalDocument("kvkk")}
        />
        <SignupConsent
          checked={termsAccepted}
          label={t("terms_label")}
          linkLabel={t("terms_link")}
          onToggle={() => setTermsAccepted((prev) => !prev)}
          onOpen={() => void openLegalDocument("terms")}
        />

        {errorMessage ? (
          <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
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

type SignupConsentProps = {
  checked: boolean;
  label: string;
  linkLabel: string;
  onToggle: () => void;
  onOpen: () => void;
};

function SignupConsent({ checked, label, linkLabel, onToggle, onOpen }: SignupConsentProps) {
  const { palette, radii, touchTargets } = useThemeTokens();
  return (
    <View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked }}
        onPress={() => {
          haptics.selection();
          onToggle();
        }}
        style={[styles.checkRow, { minHeight: touchTargets.comfortable }]}
      >
        <View
          style={[
            styles.checkbox,
            {
              borderRadius: radii.inner,
              borderColor: checked ? palette.ctaPlayBg : palette.border,
              backgroundColor: checked ? palette.ctaPlayBg : palette.surface,
            },
          ]}
        >
          {checked ? <AppText variant="caption" tone="ctaInk">✓</AppText> : null}
        </View>
        <AppText variant="caption" style={styles.checkLabel}>{label}</AppText>
      </Pressable>
      <Pressable
        accessibilityRole="link"
        onPress={onOpen}
        style={[styles.legalLink, { minHeight: touchTargets.comfortable }]}
      >
        <AppText variant="caption" style={[styles.legalLabel, { color: palette.playSelectedInk }]}>
          {linkLabel}
        </AppText>
      </Pressable>
    </View>
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
  },
  checkLabel: {
    flex: 1,
  },
  legalLink: {
    alignSelf: "flex-start",
    justifyContent: "center",
    marginLeft: 32,
  },
  legalLabel: {
    fontWeight: "800",
    textDecorationLine: "underline",
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
