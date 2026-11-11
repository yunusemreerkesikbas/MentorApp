import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  hasCompletedOnboarding,
  isWaitlistOn,
  opensWaitlist,
  postAuthDestination,
} from "@mentor/core";
import { ApiClientError } from "@mentor/api-client";
import { loginSchema } from "@mentor/validation";
import { Button, Card, TextField, AppText } from "../../components/ui/index.js";
import { haptics } from "../../lib/haptics.js";
import { useAppAvailability } from "../../providers/availability-provider.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const { availability } = useAppAvailability();
  const { palette, space } = useThemeTokens();
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");

  const emailRef = useRef("");
  const passwordRef = useRef("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMessage(null);
    const parsed = loginSchema.safeParse({
      email: emailRef.current.trim(),
      password: passwordRef.current,
    });
    if (!parsed.success) {
      haptics.error();
      setErrorMessage(t("invalid_form"));
      return;
    }

    setSubmitting(true);
    try {
      const user = await login(parsed.data);
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
        router.replace("/(auth)/waitlist" as never);
        return;
      }
      setErrorMessage(
        err instanceof ApiClientError ? err.message : tCommon("error_body"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const signupHref = isWaitlistOn(availability)
    ? "/(auth)/waitlist"
    : "/(auth)/signup";

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
        <AppText variant="title">{t("login_title")}</AppText>
        <AppText variant="body" tone="secondary">
          {t("login_subtitle")}
        </AppText>
      </View>

      <Card style={{ gap: space.md }}>
        <TextField
          label={t("email_label")}
          placeholder={t("email_placeholder")}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={(val) => {
            emailRef.current = val;
          }}
        />
        <TextField
          label={t("password_label")}
          placeholder={t("password_placeholder")}
          secureTextEntry
          autoCapitalize="none"
          onChangeText={(val) => {
            passwordRef.current = val;
          }}
          errorMessage={errorMessage}
        />

        <Pressable
          accessibilityRole="link"
          hitSlop={8}
          onPress={() => router.push("/(auth)/forgot-password" as never)}
          style={styles.forgotLink}
        >
          <AppText variant="caption" tone="accent">
            {t("forgot_link")}
          </AppText>
        </Pressable>

        <Button
          label={t("login_submit")}
          loading={submitting}
          onPress={() => {
            void handleSubmit();
          }}
          variant="primary"
        />
      </Card>

      <View style={styles.footerRow}>
        <AppText variant="caption" tone="secondary">
          {t("register_prompt")}{" "}
        </AppText>
        <Pressable
          accessibilityRole="link"
          hitSlop={8}
          onPress={() => router.push(signupHref as never)}
        >
          <AppText variant="caption" tone="accent">
            {t("register_link")}
          </AppText>
        </Pressable>
      </View>

      <Button
        label={t("back_welcome")}
        onPress={() => router.back()}
        variant="secondary"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  forgotLink: {
    alignSelf: "flex-end",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
});
