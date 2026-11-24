import { useState } from "react";
import { useRouter } from "expo-router";
import { ApiClientError, authControllerForgotPassword } from "@mentor/api-client";
import { forgotPasswordSchema } from "@mentor/validation";
import { AuthFormScreen } from "../../components/auth/auth-form-screen.js";
import { Button, TextField, AppText } from "../../components/ui/index.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMessage(null);
    const parsed = forgotPasswordSchema.safeParse({ email: email.trim() });
    if (!parsed.success) {
      haptics.error();
      setErrorMessage(t("invalid_form"));
      return;
    }

    setSubmitting(true);
    try {
      await authControllerForgotPassword(parsed.data);
      haptics.success();
      setSent(true);
    } catch (err) {
      haptics.error();
      setErrorMessage(
        err instanceof ApiClientError ? err.message : tCommon("error_body"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFormScreen title={t("forgot_title")} subtitle={t("forgot_subtitle")}
      back={{ label: t("login_link"), onPress: () => {
        if (router.canGoBack()) router.back();
        else router.replace("/(auth)/login");
      } }}>
      {sent ? (
        <AppText tone="success" accessibilityLiveRegion="polite">{t("forgot_success")}</AppText>
      ) : (
        <>
          <TextField
            label={t("email_label")}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            errorMessage={errorMessage}
          />
          <Button label={t("forgot_submit")} loading={submitting} onPress={() => void handleSubmit()} />
        </>
      )}
    </AuthFormScreen>
  );
}
