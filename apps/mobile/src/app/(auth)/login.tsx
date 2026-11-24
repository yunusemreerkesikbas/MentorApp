import { useRef, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import {
  hasCompletedOnboarding,
  isWaitlistOn,
  opensWaitlist,
  postAuthDestination,
} from "@mentor/core";
import { ApiClientError } from "@mentor/api-client";
import { loginSchema } from "@mentor/validation";
import { AuthFormLink, AuthFormScreen, type AuthFormPose } from "../../components/auth/auth-form-screen.js";
import { Button, TextField, AppText } from "../../components/ui/index.js";
import { haptics } from "../../lib/haptics.js";
import { useAppAvailability } from "../../providers/availability-provider.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { availability } = useAppAvailability();
  const { space } = useThemeTokens();
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");

  const [pose, setPose] = useState<AuthFormPose>("rest");
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
    <AuthFormScreen title={t("login_title")} pose={pose}>
      <TextField
        label={t("email_label")}
        keyboardType="email-address"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setPose("lookDown")}
        onBlur={() => setPose("rest")}
        onChangeText={(value) => { emailRef.current = value; }}
      />
      <TextField
        label={t("password_label")}
        secureTextEntry
        autoComplete="current-password"
        autoCapitalize="none"
        onFocus={() => setPose("cover")}
        onBlur={() => setPose("rest")}
        onChangeText={(value) => { passwordRef.current = value; }}
        errorMessage={errorMessage}
      />
      <View style={{ alignSelf: "flex-end" }}>
        <AuthFormLink label={t("forgot_link")} onPress={() => router.push("/(auth)/forgot-password")} />
      </View>
      <Button label={t("login_submit")} loading={submitting} onPress={() => void handleSubmit()} />

      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", columnGap: space.xs }}>
        <AppText tone="secondary">{t("register_prompt")}</AppText>
        <AuthFormLink label={t("register_link")} onPress={() => router.push(signupHref)} />
      </View>
      <View style={{ alignSelf: "center" }}>
        <AuthFormLink label={t("back_welcome")} onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace("/(auth)/welcome");
        }} />
      </View>
    </AuthFormScreen>
  );
}
