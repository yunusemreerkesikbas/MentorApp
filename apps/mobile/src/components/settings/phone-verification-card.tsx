import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { PhoneStatusDto, PhoneVerificationDto } from "@mentor/types";
import {
  ApiClientError,
  phoneControllerConfirmVerification,
  phoneControllerGetStatus,
  phoneControllerRequestVerification,
} from "@mentor/api-client";
import {
  phoneVerificationConfirmSchema,
  phoneVerificationRequestSchema,
} from "@mentor/validation";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText, Button, Card, Chip, TextField } from "../ui/index.js";

export function PhoneVerificationCard() {
  const { space } = useThemeTokens();
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");

  const [status, setStatus] = useState<PhoneStatusDto | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<PhoneVerificationDto | null>(null);
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    phoneControllerGetStatus()
      .then((res) => {
        if (!active || !res) return;
        setStatus(res as unknown as PhoneStatusDto);
      })
      .catch(() => {
        // Non-blocking: hide if status endpoint is unreachable.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!challenge) return;
    const timers = [challenge.resendAvailableAt, challenge.expiresAt].map(
      (deadline) =>
        setTimeout(
          () => setNow(Date.now()),
          Math.max(0, Date.parse(deadline) - Date.now()),
        ),
    );
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [challenge]);

  if (!status) return null;
  if (!status.available && !status.verified) return null;

  const showFailure = (err: unknown) => {
    haptics.error();
    setErrorMessage(
      err instanceof ApiClientError ? err.message : tCommon("error_body"),
    );
    if (
      err instanceof ApiClientError &&
      err.body.code === "AUTH_PHONE_REAUTHENTICATION_REQUIRED"
    ) {
      setStatus((cur) =>
        cur ? { ...cur, reauthenticationRequired: true } : cur,
      );
    }
    if (
      err instanceof ApiClientError &&
      err.body.code === "AUTH_PHONE_DISABLED"
    ) {
      setStatus((cur) => (cur ? { ...cur, available: false } : cur));
    }
  };

  const handleRequestCode = async () => {
    setErrorMessage(null);
    setBusy(true);
    const input = { phoneNumber: phoneNumber.trim() };
    const parsed = phoneVerificationRequestSchema.safeParse(input);
    try {
      const next = (await phoneControllerRequestVerification(
        parsed.success ? parsed.data : input,
      )) as unknown as PhoneVerificationDto;
      haptics.success();
      setChallenge(next);
      setCode("");
      setNow(Date.now());
    } catch (err) {
      showFailure(err);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmCode = async () => {
    if (!challenge) return;
    setErrorMessage(null);
    setBusy(true);
    const parsed = phoneVerificationConfirmSchema.safeParse({
      code: code.trim(),
    });
    try {
      const next = (await phoneControllerConfirmVerification(
        challenge.challengeId,
        parsed.success ? parsed.data : { code: code.trim() },
      )) as unknown as PhoneStatusDto;
      haptics.success();
      setStatus(next);
      setChanging(false);
      setChallenge(null);
      setPhoneNumber("");
      setCode("");
    } catch (err) {
      showFailure(err);
    } finally {
      setBusy(false);
    }
  };

  const canResend = challenge
    ? Date.parse(challenge.resendAvailableAt) <= now
    : false;
  const isVerifiedView = status.verified && !changing;

  return (
    <Card style={{ gap: space.md }}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="sectionHeading">{t("phone_title")}</AppText>
          <AppText variant="caption" tone="secondary">
            {t("phone_hint")}
          </AppText>
        </View>
        {status.verified ? (
          <Chip label={t("phone_verified_badge")} selected />
        ) : null}
      </View>

      {isVerifiedView ? (
        <View style={{ gap: space.sm }}>
          {status.maskedPhoneNumber ? (
            <AppText variant="cardTitle" tabularNums>
              {t("phone_verified", { phone: status.maskedPhoneNumber })}
            </AppText>
          ) : null}
          {status.available ? (
            <Button
              label={t("phone_change")}
              variant="secondary"
              onPress={() => {
                setChanging(true);
                setErrorMessage(null);
              }}
            />
          ) : null}
        </View>
      ) : status.reauthenticationRequired ? (
        <AppText variant="caption" tone="warning">
          {t("phone_reauth_hint")}
        </AppText>
      ) : !status.available ? (
        <AppText variant="caption" tone="secondary">
          {t("phone_unavailable")}
        </AppText>
      ) : challenge ? (
        <View style={{ gap: space.md }}>
          <AppText variant="caption" tone="secondary">
            {t("phone_code_sent", { phone: challenge.maskedPhoneNumber })}
          </AppText>
          <TextField
            label={t("phone_code_label")}
            placeholder={t("phone_code_placeholder")}
            value={code}
            onChangeText={(val) => {
              setCode(val.replace(/\D/g, "").slice(0, 6));
              setErrorMessage(null);
            }}
            keyboardType="number-pad"
            maxLength={6}
            errorMessage={errorMessage}
          />
          <Button
            label={t("phone_confirm_cta")}
            loading={busy}
            disabled={code.trim().length !== 6}
            onPress={() => {
              void handleConfirmCode();
            }}
            variant="primary"
          />
          <View style={styles.actionsRow}>
            <Button
              label={t("phone_resend_cta")}
              disabled={!canResend || busy}
              onPress={() => {
                void handleRequestCode();
              }}
              variant="secondary"
            />
            <Button
              label={tCommon("cancel")}
              disabled={busy}
              onPress={() => {
                setChallenge(null);
                setCode("");
                setErrorMessage(null);
              }}
              variant="secondary"
            />
          </View>
        </View>
      ) : (
        <View style={{ gap: space.md }}>
          <TextField
            label={t("phone_input_label")}
            placeholder={t("phone_input_placeholder")}
            value={phoneNumber}
            onChangeText={(val) => {
              setPhoneNumber(val);
              setErrorMessage(null);
            }}
            keyboardType="phone-pad"
            errorMessage={errorMessage}
          />
          <Button
            label={t("phone_send_cta")}
            loading={busy}
            disabled={phoneNumber.trim().length < 10}
            onPress={() => {
              void handleRequestCode();
            }}
            variant="primary"
          />
          {changing ? (
            <Button
              label={tCommon("cancel")}
              disabled={busy}
              onPress={() => {
                setChanging(false);
                setErrorMessage(null);
              }}
              variant="secondary"
            />
          ) : null}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
