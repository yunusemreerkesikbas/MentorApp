import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiClientError } from "@mentor/api-client";
import type { AttachmentInput } from "@mentor/validation";
import { fontFamilyFor } from "../../lib/fonts.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { useToast } from "../../providers/toast-provider.js";
import { Button } from "../ui/index.js";
import { AttachButton, AttachmentStrip, useForumAttachments } from "./attachment-picker.js";

/**
 * The bottom compose bar of a post or comment detail: text, up to four photos, send. Photos upload
 * on send; any failure keeps the text and the photos for another try.
 */
export function ReplyBar({ placeholder, submitLabel, onSubmit }: {
  placeholder: string;
  submitLabel: string;
  onSubmit: (body: string, attachments: AttachmentInput[]) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const { palette, radii, typeScale } = useThemeTokens();
  const t = useTranslations("community");
  const toast = useToast();
  const picker = useForumAttachments();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    picker.setError(null);
    try {
      let attachments: AttachmentInput[];
      try {
        attachments = await picker.uploadAll();
      } catch {
        picker.setError(t("attach_failed"));
        return;
      }
      await onSubmit(body, attachments);
      haptics.success();
      setText("");
      picker.reset();
    } catch (err) {
      toast.show(err instanceof ApiClientError ? err.message : t("composer_error"));
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={[styles.bar, { backgroundColor: palette.surface, borderTopColor: palette.playLine, paddingBottom: Math.max(10, insets.bottom) }]}>
      <AttachmentStrip picker={picker} disabled={sending} />
      <View style={styles.row}>
        <AttachButton picker={picker} disabled={sending} />
        <TextInput
          accessibilityLabel={placeholder}
          placeholder={placeholder}
          placeholderTextColor={palette.muted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={4000}
          style={[styles.input, {
            backgroundColor: palette.surfaceAlt, borderColor: palette.border, borderRadius: radii.inner, color: palette.main,
            fontSize: typeScale.body.fontSize, fontFamily: fontFamilyFor(typeScale.body.fontWeight),
          }]}
        />
        <Button label={submitLabel} onPress={() => void send()} loading={sending} disabled={!text.trim()} variant="primary" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingTop: 8, gap: 4 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  input: { flex: 1, minHeight: 44, maxHeight: 110, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
});
