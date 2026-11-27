import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Attachment } from "@mentor/types";
import { CloseCircleIcon } from "@solar-icons/react-native/linear/close-circle";
import { FileTextIcon } from "@solar-icons/react-native/linear/file-text";
import { formatBytes } from "../../lib/community-view.js";
import { attachmentUrl } from "../../lib/forum-attachments.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { openInApp } from "../settings/settings-cards.js";
import { AppText } from "../ui/index.js";

/**
 * The web's `AttachmentGallery`: one image at its own ratio (4:3 crop in feed cards), several as a
 * swipe rail, files as chips that open in the in-app browser. A tap opens the uncropped viewer.
 */
export function AttachmentGallery({ attachments, compactSingle = false }: { attachments: Attachment[]; compactSingle?: boolean }) {
  const t = useTranslations("community");
  const { palette, radii } = useThemeTokens();
  const [active, setActive] = useState<number | null>(null);
  const images = attachments.filter((a) => a.kind === "image");
  const files = attachments.filter((a) => a.kind === "file");
  if (images.length === 0 && files.length === 0) return null;

  const frame = { borderRadius: radii.card, borderColor: palette.border, backgroundColor: palette.surfaceAlt };
  const single = images[0] && images.length === 1 ? images[0] : null;
  // ponytail: a missing size falls back to 4:3, the server never measures images.
  const ratio = single?.width && single.height ? Math.max(0.6, single.width / single.height) : 4 / 3;

  return (
    <View style={{ gap: 8 }}>
      {single ? (
        <Pressable accessibilityRole="imagebutton" accessibilityLabel={t("attach_view")} onPress={() => setActive(0)}
          style={[styles.tile, frame, { aspectRatio: compactSingle ? 4 / 3 : ratio }]}>
          <Image source={{ uri: attachmentUrl(single.url) }} style={StyleSheet.absoluteFill} accessible={false}
            contentFit={compactSingle ? "cover" : "contain"} contentPosition="top" />
        </Pressable>
      ) : images.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {images.map((a, i) => (
            <Pressable key={a.id} accessibilityRole="imagebutton" accessibilityLabel={t("attach_view")} onPress={() => setActive(i)}
              style={[styles.tile, styles.railTile, frame]}>
              <Image source={{ uri: attachmentUrl(a.url) }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {files.map((a) => (
        <Pressable key={a.id} accessibilityRole="link" onPress={() => openInApp(attachmentUrl(a.url))}
          style={[styles.file, { borderRadius: radii.inner, borderColor: palette.border }]}>
          <FileTextIcon size={20} color={palette.secondary} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText numberOfLines={1} style={{ fontSize: 13, fontWeight: "700" }}>{a.fileName ?? t("attach_file")}</AppText>
            <AppText variant="caption" tone="secondary">{formatBytes(a.sizeBytes)}</AppText>
          </View>
        </Pressable>
      ))}
      {active !== null ? <AttachmentViewer images={images} start={active} onClose={() => setActive(null)} /> : null}
    </View>
  );
}

function AttachmentViewer({ images, start, onClose }: { images: Attachment[]; start: number; onClose: () => void }) {
  const t = useTranslations("community");
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(start);
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.viewer}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          contentOffset={{ x: start * width, y: 0 }}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}>
          {images.map((a) => (
            <Image key={a.id} source={{ uri: attachmentUrl(a.url) }} contentFit="contain" accessible={false} style={{ width, height }} />
          ))}
        </ScrollView>
        <Pressable accessibilityRole="button" accessibilityLabel={t("attach_close")} onPress={onClose} hitSlop={8}
          style={[styles.close, { top: insets.top + 8 }]}>
          <CloseCircleIcon size={32} color="#FFFFFF" />
        </Pressable>
        {images.length > 1 ? (
          <View style={[styles.dots, { bottom: insets.bottom + 20 }]}>
            {images.map((a, i) => <View key={a.id} style={[styles.dot, { opacity: i === index ? 1 : 0.4 }]} />)}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tile: { width: "100%", overflow: "hidden", borderWidth: 1 },
  railTile: { width: 260, aspectRatio: 16 / 9 },
  file: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
  viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.94)" },
  close: { position: "absolute", right: 16, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  dots: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFFFFF" },
});
