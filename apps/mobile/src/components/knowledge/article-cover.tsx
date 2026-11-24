import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Book2Icon } from "@solar-icons/react-native/linear/book-2";
import { CalendarMarkIcon } from "@solar-icons/react-native/linear/calendar-mark";
import { ClipboardListIcon } from "@solar-icons/react-native/linear/clipboard-list";
import type { InfoArticleSummaryDto } from "@mentor/types";
import { useThemeTokens } from "../../providers/theme-provider.js";

function CategoryFallbackGlyph({
  category,
  size,
  color,
}: {
  category: string;
  size: number;
  color: string;
}) {
  if (category === "APPLICATION") {
    return <ClipboardListIcon size={size} color={color} strokeWidth={1.75} />;
  }
  if (category === "EXAM_PROCESS") {
    return <CalendarMarkIcon size={size} color={color} strokeWidth={1.75} />;
  }
  return <Book2Icon size={size} color={color} strokeWidth={1.75} />;
}

export function ArticleCover({
  article,
  variant,
}: {
  article: InfoArticleSummaryDto;
  variant: "featured" | "row" | "related" | "reader";
}) {
  const { palette, radii } = useThemeTokens();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const url = article.coverImage?.url ?? null;
  const hasCover = Boolean(url) && failedUrl !== url;
  const glyphSize = variant === "featured" || variant === "reader" ? 28 : 22;

  if (!hasCover) {
    if (variant === "reader") return null;
    return (
      <View style={styles.glyphSlot}>
        <CategoryFallbackGlyph
          category={article.category}
          size={glyphSize}
          color={palette.secondary}
        />
      </View>
    );
  }

  const imageStyle =
    variant === "featured" || variant === "reader"
      ? [styles.wideImage, { borderRadius: radii.inner, backgroundColor: palette.surfaceAlt }]
      : variant === "related"
        ? [styles.relatedImage, { borderRadius: 12, backgroundColor: palette.surfaceAlt }]
        : [styles.rowImage, { borderRadius: radii.inner, backgroundColor: palette.surfaceAlt }];

  return (
    <Image
      source={{ uri: url! }}
      accessibilityLabel={article.coverImage!.alt}
      contentFit="cover"
      onError={() => setFailedUrl(url)}
      style={imageStyle}
    />
  );
}

const styles = StyleSheet.create({
  glyphSlot: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  wideImage: {
    width: "100%",
    aspectRatio: 16 / 9,
  },
  rowImage: {
    width: 68,
    height: 68,
  },
  relatedImage: {
    width: 48,
    height: 48,
  },
});
