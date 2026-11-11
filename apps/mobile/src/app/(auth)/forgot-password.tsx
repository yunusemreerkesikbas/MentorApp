import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiClientError, authControllerForgotPassword } from "@mentor/api-client";
import { forgotPasswordSchema } from "@mentor/validation";
import { Button, Card, TextField, AppText } from "../../components/ui/index.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette, space } = useThemeTokens();
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
        <AppText variant="title">{t("forgot_title")}</AppText>
        <AppText variant="body" tone="secondary">
          {t("forgot_subtitle")}
        </AppText>
      </View>

      <Card style={{ gap: space.md }}>
        {sent ? (
          <View style={{ gap: space.md }}>
            <AppText variant="body" tone="success">
              {t("forgot_success")}
            </AppText>
            <Button
              label={t("login_link")}
              onPress={() => router.replace("/(auth)/login" as never)}
              variant="primary"
            />
          </View>
        ) : (
          <>
            <TextField
              label={t("email_label")}
              placeholder={t("email_placeholder")}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              errorMessage={errorMessage}
            />
            <Button
              label={t("forgot_submit")}
              loading={submitting}
              onPress={() => {
                void handleSubmit();
              }}
              variant="primary"
            />
          </>
        )}
      </Card>

      <Button
        label={t("login_link")}
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
});
