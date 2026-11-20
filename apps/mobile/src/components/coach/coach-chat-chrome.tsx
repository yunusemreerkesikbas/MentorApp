import { useState, type ReactNode } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { PanelRightIcon } from "@solar-icons/react-native/linear/panel-right";
import { Plane2Icon } from "@solar-icons/react-native/linear/plane-2";
import { firstName, greetingKeyForHour } from "@mentor/core";
import type { CoachConversationDto } from "@mentor/types";
import { art } from "../../lib/art.js";
import { fontFamilyFor } from "../../lib/fonts.js";
import { cardShadow } from "../../lib/layout.js";
import { useIsPremium } from "../../lib/premium.js";
import { signupLegalUrl } from "../../lib/signup-legal.js";
import { useAuth } from "../../providers/auth-provider.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { BottomSheet } from "../panel/primitives.js";
import { AppText, Button, Chip } from "../ui/index.js";
import { CoachProfileMemoryCard } from "./coach-profile-memory-card.js";

export { AmbientBackdrop as CoachChatBackdrop } from "../ui/ambient-backdrop.js";

export function CoachHistoryButton({ onPress }: { onPress: () => void }) {
  const t = useTranslations("coach");
  const { palette, radii, touchTargets } = useThemeTokens();
  return <Pressable accessibilityRole="button" accessibilityLabel={t("history_open")} onPress={onPress}
    style={[cardShadow, { width: touchTargets.min, height: touchTargets.min, borderRadius: radii.pill, backgroundColor: palette.surface, alignItems: "center", justifyContent: "center" }]}>
    <PanelRightIcon size={20} color={palette.main} />
  </Pressable>;
}

export function CoachWelcome() {
  const { user } = useAuth();
  const premium = useIsPremium();
  const t = useTranslations("coach");
  const { space, typeScale } = useThemeTokens();
  return <View style={{ flex: 1, gap: space.md, paddingHorizontal: space.lg, paddingTop: space.sm }}>
    <View style={{ gap: space.xs, alignItems: "center" }}>
      <AppText style={{ fontSize: typeScale.title.fontSize, lineHeight: typeScale.title.lineHeight, textAlign: "center" }}>
        {t(greetingKeyForHour(), { name: firstName(user?.displayName ?? "") })}
      </AppText>
      <AppText variant="title" style={{ textAlign: "center" }}>{t("welcome_help")}</AppText>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingVertical: space.sm }}>
      <CoachProfileMemoryCard calibrationOnly>
        <Image source={premium ? art.puhuPremiumHero : art.puhuEncouraging} contentFit="contain"
          style={{ alignSelf: "center", width: premium ? 168 : 120, height: premium ? 168 : 120 }} />
      </CoachProfileMemoryCard>
    </ScrollView>
  </View>;
}

export function CoachHistorySheet({ open, conversations, selectedId, onClose, onSelect }: {
  open: boolean;
  conversations: CoachConversationDto[];
  selectedId: string | null;
  onClose: () => void;
  onSelect: (id: string | null) => void;
}) {
  const t = useTranslations("coach");
  const common = useTranslations("common");
  const { space } = useThemeTokens();
  return <BottomSheet visible={open} onClose={onClose} closeLabel={common("close")}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.md }}>
      <AppText variant="sectionHeading">{t("threads_title")}</AppText>
      <Button label={t("new_chat_cta")} onPress={() => { onSelect(null); onClose(); }} />
      {conversations.map((conversation) => <Chip key={conversation.id} label={conversation.title}
        selected={conversation.id === selectedId} onPress={() => { onSelect(conversation.id); onClose(); }} />)}
      <CoachProfileMemoryCard />
      <Button label={common("close")} variant="secondary" onPress={onClose} />
    </ScrollView>
  </BottomSheet>;
}

export function CoachComposer({ value, busy, canChat, error, remaining, keyboardOpen, onChange, onSend, children }: {
  value: string;
  busy: boolean;
  canChat: boolean;
  error: string | null;
  remaining?: number;
  keyboardOpen: boolean;
  onChange: (text: string) => void;
  onSend: () => void;
  children?: ReactNode;
}) {
  const t = useTranslations("coach");
  const common = useTranslations("common");
  const { locale } = useLocale();
  const { palette, radii, space, touchTargets, typeScale } = useThemeTokens();
  const [linkError, setLinkError] = useState(false);
  const disabled = busy || !canChat || !value.trim();
  return <View style={{ gap: space.xs, paddingHorizontal: space.lg, paddingBottom: space.sm }}>
    {!keyboardOpen ? children : null}
    {remaining !== undefined ? <AppText variant="micro" tone="muted" style={{ textAlign: "center" }}>{t("remaining_messages", { count: remaining })}</AppText> : null}
    {!canChat ? <AppText variant="caption" tone="secondary">{t("access_unavailable")}</AppText> : null}
    {error ? <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">{error}</AppText> : null}
    <View style={[cardShadow, { backgroundColor: palette.surface, borderRadius: radii.card, padding: space.sm, gap: space.xs }]}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.sm }}>
        <Image source={art.puhuDefault} contentFit="contain" style={{ width: 28, height: 28, marginTop: space.sm }} />
        <TextInput accessibilityLabel={t("input_label")} value={value} onChangeText={onChange} multiline
          placeholder={t("input_placeholder")} placeholderTextColor={palette.secondary} editable={!busy}
          style={{ flex: 1, minHeight: touchTargets.min, maxHeight: 222, paddingVertical: space.sm, paddingHorizontal: 0, color: palette.main, fontSize: typeScale.body.fontSize, fontFamily: fontFamilyFor(typeScale.body.fontWeight) }} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={busy ? t("sending_cta") : t("send_cta")}
        accessibilityState={{ disabled, busy }} disabled={disabled} onPress={onSend}
        style={{ alignSelf: "flex-end", minWidth: touchTargets.min, minHeight: touchTargets.min, borderRadius: radii.pill, backgroundColor: palette.progress, opacity: disabled ? 0.4 : 1, alignItems: "center", justifyContent: "center" }}>
        {busy ? <ActivityIndicator color={palette.ctaPlayInk} /> : <Plane2Icon size={20} color={palette.ctaPlayInk} />}
      </Pressable>
    </View>
    {!keyboardOpen ? <>
      <AppText variant="micro" tone="secondary" style={styles.notice}>{t("disclaimer")}</AppText>
      <AppText variant="micro" tone="secondary" style={styles.notice}>{t("privacy_notice")}</AppText>
      <Pressable accessibilityRole="link" onPress={() => {
        setLinkError(false);
        void Linking.openURL(signupLegalUrl("privacy", locale)).catch(() => setLinkError(true));
      }} style={{ minHeight: touchTargets.min, alignItems: "center", justifyContent: "center" }}>
        <AppText variant="micro" style={{ color: palette.progress }}>{t("privacy_link")}</AppText>
      </Pressable>
    </> : null}
    {linkError ? <AppText tone="danger" variant="caption">{common("error_body")}</AppText> : null}
  </View>;
}

const styles = StyleSheet.create({ notice: { fontSize: 10, lineHeight: 13, textAlign: "center" } });
