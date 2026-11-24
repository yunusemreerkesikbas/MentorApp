import { useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { art } from "../../lib/art.js";
import { haptics } from "../../lib/haptics.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { useThemeTokens } from "../../providers/theme-provider.js";

/**
 * The header lamp, from the web's `MobileThemeLamp` (`LAMP_LAYOUT.header`): a 44dp slot in the
 * bar, with a 74x104 scene hung from it so the shade sits in the bar and Puhu hangs over the page.
 * Tapping pulls the cord and flips the theme. The web's pointer-gaze choreography has no touch
 * equivalent, so Puhu only reaches for the cord while it is pulled.
 */
const SCENE = { width: 74, height: 104, hangOffset: 10 } as const;
const SHADE = { width: 35, centreX: 51, top: 6 } as const;
const CORD = { x: 51, length: 28 } as const;
/** The shade art is 320x282 with the painted lamp filling its width. */
const SHADE_HEIGHT = Math.round((SHADE.width * 282) / 320);
/** The owl sprites are 320 square; the body is about three quarters of the frame. */
const OWL_FRAME = 64;
const PULL_DISTANCE = 7;

export function ThemeLamp() {
  const { mode, palette, setThemePreference } = useThemeTokens();
  const t = useTranslations("nav");
  const pull = useRef(new Animated.Value(0)).current;
  const [reaching, setReaching] = useState(false);

  const toggle = () => {
    haptics.selection();
    setReaching(true);
    Animated.sequence([
      Animated.timing(pull, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.spring(pull, { toValue: 0, damping: 9, stiffness: 220, useNativeDriver: true }),
    ]).start(() => setReaching(false));
    setThemePreference(mode === "dark" ? "light" : "dark");
  };

  const cordShift = pull.interpolate({ inputRange: [0, 1], outputRange: [0, PULL_DISTANCE] });
  const cordTop = SHADE.top + SHADE_HEIGHT - 2;

  return (
    <View style={styles.slot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mode === "dark" ? t("theme_to_light") : t("theme_to_dark")}
        onPress={toggle}
        hitSlop={4}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.scene}>
        <Image
          source={reaching ? art.puhuLampReach : art.puhuLampRest}
          style={styles.owl}
          contentFit="contain"
        />
        <Animated.View
          style={[
            styles.cord,
            { top: cordTop, left: CORD.x - 0.75, transform: [{ translateY: cordShift }] },
          ]}
        >
          <View style={[styles.cordLine, { backgroundColor: palette.muted }]} />
          <View style={[styles.cordKnob, { backgroundColor: palette.muted }]} />
        </Animated.View>
        <Image
          source={art.lampShade}
          style={[styles.shade, { left: SHADE.centreX - SHADE.width / 2, top: SHADE.top }]}
          contentFit="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: 44,
    height: 44,
  },
  scene: {
    position: "absolute",
    right: 0,
    top: -SCENE.hangOffset,
    width: SCENE.width,
    height: SCENE.height,
  },
  shade: {
    position: "absolute",
    width: SHADE.width,
    height: SHADE_HEIGHT,
  },
  cord: {
    position: "absolute",
    alignItems: "center",
  },
  cordLine: {
    width: 1.5,
    height: CORD.length,
  },
  cordKnob: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  owl: {
    position: "absolute",
    left: -8,
    bottom: 0,
    width: OWL_FRAME,
    height: OWL_FRAME,
  },
});
