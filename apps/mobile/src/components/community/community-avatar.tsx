import { Image, StyleSheet, View } from "react-native";
import { useThemeTokens } from "../../providers/theme-provider.js";
import { AppText } from "../ui/index.js";

export function CommunityAvatar({
  name,
  avatarUrl,
  size = 36,
}: {
  name: string;
  avatarUrl: string | null;
  size?: number;
}) {
  const { palette } = useThemeTokens();
  const initial = (name.trim().charAt(0) || "P").toLocaleUpperCase("tr-TR");
  const radius = size / 2;

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: palette.surfaceAlt,
          },
        ]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: palette.playSelected,
          borderColor: palette.playLine,
        },
      ]}
    >
      <AppText
        style={{
          color: palette.playSelectedInk,
          fontSize: Math.max(12, Math.round(size * 0.42)),
          fontWeight: "800",
        }}
      >
        {initial}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    flexShrink: 0,
  },
  fallback: {
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
