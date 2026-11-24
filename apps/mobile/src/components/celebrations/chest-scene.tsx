import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StarsIcon } from "@solar-icons/react-native/bold/stars";
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import type { WeeklyChestView } from "@mentor/types";
import { art, chestSceneArt } from "../../lib/art.js";
import { openWeeklyChest } from "../../lib/coaching-api.js";
import { haptics } from "../../lib/haptics.js";
import { PREMIUM_MASK_EYES, PREMIUM_MASK_OUTLINE, useIsPremium } from "../../lib/premium.js";
import { useLocale, useTranslations } from "../../providers/i18n-provider.js";
import { chestLamps, noteLines } from "../panel/chest.js";
import { AppText } from "../ui/text.js";
import { CoinArt } from "./scenes.js";

/** The web's `weekly-chest.css` night: the room keeps its own colours in both themes. */
const C = {
  ground: "#1C130D",
  title: "#FFF4DC",
  body: "#E9D6B8",
  gold: "#FFD15C",
  goldInk: "#3A2306",
  goldEdge: "#C98F22",
  paper: "#FFFDF6",
  rule: "rgba(29, 111, 191, 0.14)",
  ink: "#2A1C10",
  eyebrow: "#1D6FBF",
  tape: "rgba(255, 209, 92, 0.82)",
  ghostLine: "rgba(233, 214, 184, 0.35)",
};
/** Where the brass strip sits on the 9:16 desk (the web's `deskTall`), as fractions of the art. */
const STRIP = { left: 0.346, right: 0.661, top: 0.766, bottom: 0.802, lock: { x: 0.507, y: 0.723 } };
/** How long the lamps take to flow into the lock before the lid opens. */
const FLOW_MS = 400;
const HAND = "Caveat_700Bold";

type Phase = "ready" | "flow" | "clip" | "inside";

/**
 * "Masa lambası" (the web's `ChestScene`, upright set): the chest on Puhu's desk, one lamp per day.
 * Tap → the lamps flow into the lock → Puhu opens it (clip, tap to skip) → the week's note and the
 * Coin. An opened chest goes straight to the note. Reduced motion: no clip, a crossfade.
 * `onClose(opened)` tells the panel whether the chest was stamped, so it can refresh.
 */
export function ChestScene({
  chest,
  onClose,
}: {
  chest: WeeklyChestView;
  onClose: (opened: boolean) => void;
}) {
  const t = useTranslations("panel");
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const revisit = chest.state === "OPENED";
  const still = reduceMotion || revisit;
  const [phase, setPhase] = useState<Phase>(revisit ? "inside" : "ready");
  const [view, setView] = useState(chest);
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState({ width: screen.width, height: screen.height });
  const stamped = useRef(false);
  const player = useVideoPlayer(still ? null : chestSceneArt.clip, (created) => {
    created.muted = true;
  });
  const close = () => onClose(stamped.current);

  useEffect(() => {
    // Only the clip moves the scene on: an empty player (reduced motion, revisit) reports its end
    // at once, which must not skip the chest's opening.
    const after = (current: Phase): Phase => (current === "flow" || current === "clip" ? "inside" : current);
    const ended = player.addListener("playToEnd", () => setPhase(after));
    // A clip that cannot play skips straight to the note.
    const status = player.addListener("statusChange", ({ status: next }) => {
      if (next === "error") setPhase(after);
    });
    return () => {
      ended.remove();
      status.remove();
    };
  }, [player]);

  useEffect(() => {
    if (phase === "flow") {
      const timer = setTimeout(() => setPhase("clip"), FLOW_MS);
      return () => clearTimeout(timer);
    }
    if (phase === "clip") {
      if (player.status === "error") setPhase("inside");
      else player.play();
    }
  }, [phase, player]);

  const open = () => {
    if (phase !== "ready") return;
    openWeeklyChest(chest.periodKey).then(
      (next) => {
        stamped.current = next.state === "OPENED";
        setView(next);
      },
      () => setFailed(true),
    );
    setPhase(still ? "inside" : "flow");
  };

  const skip = () => {
    player.pause();
    setPhase("inside");
  };

  const inside = phase === "inside";
  const days = chest.summary?.activeDays ?? chest.current;
  // The 9:16 room covers the screen from the desk up: a narrow phone crops its sides.
  const artWidth = Math.max(size.width, (size.height * 9) / 16);
  const artBox = {
    width: artWidth,
    height: (artWidth * 16) / 9,
    left: (size.width - artWidth) / 2,
  };

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View
        style={styles.root}
        onLayout={({ nativeEvent }) =>
          setSize({ width: nativeEvent.layout.width, height: nativeEvent.layout.height })
        }
      >
        <View style={[styles.art, artBox]} pointerEvents="none">
          <SceneArt phase={phase} still={still} player={player} lamps={chestLamps(chest)} box={artBox} />
        </View>

        {phase === "ready" || phase === "clip" ? (
          // The art itself is the tap target: open it, or skip the clip. No button over the art.
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={phase === "ready" ? open : skip}
            accessible={false}
            importantForAccessibility="no"
          />
        ) : null}

        {inside ? (
          <ScrollView
            style={StyleSheet.absoluteFill}
            contentContainerStyle={[
              styles.inside,
              { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
            ]}
          >
            <ChestNote chest={view} animate={!revisit && !reduceMotion} />
            <ChestReward chest={view} celebrate={!revisit} animate={!revisit && !reduceMotion} />
            {failed ? (
              <AppText accessibilityRole="alert" style={styles.error}>
                {t("chest_open_error")}
              </AppText>
            ) : null}
            <SceneButton gold label={t("chest_scene_continue")} onPress={close} />
          </ScrollView>
        ) : (
          <>
            {/* Upright: the title over the shelves, the buttons on the desk in front of the chest. */}
            <View
              style={[styles.shelfBar, { paddingTop: Math.max(32, insets.top + 16) }]}
              pointerEvents="none"
            >
              <Fade from="top" stops={[0.9, 0.7, 0]} />
              <AppText accessibilityRole="header" style={styles.title}>
                {chest.carriedOver
                  ? t("chest_scene_title_carried", { days })
                  : t("chest_scene_title", { days })}
              </AppText>
              <AppText style={styles.body}>{t("chest_scene_body")}</AppText>
            </View>
            <View
              style={[styles.deskBar, { paddingBottom: Math.max(24, insets.bottom + 16) }]}
              pointerEvents={phase === "ready" ? "box-none" : "none"}
            >
              <Fade from="bottom" stops={[0.92, 0.7, 0]} />
              <View style={[styles.buttons, phase !== "ready" && styles.hidden]}>
                <SceneButton gold label={t("chest_scene_open")} onPress={open} />
                <SceneButton label={t("chest_scene_later")} onPress={close} />
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

/**
 * The desk: the closed still under the clip, then the open still that steps back (dims, blurs) so
 * the note reads on top of it. The clip's own last frame is the open still, so the swap is seamless.
 */
function SceneArt({
  phase,
  still,
  player,
  lamps,
  box,
}: {
  phase: Phase;
  still: boolean;
  player: ReturnType<typeof useVideoPlayer>;
  lamps: boolean[];
  box: { width: number; height: number };
}) {
  const inside = phase === "inside";
  const dim = useRef(new Animated.Value(inside ? 1 : 0)).current;
  const closed = useRef(new Animated.Value(inside ? 0 : 1)).current;

  useEffect(() => {
    if (!inside) return;
    if (still) {
      // Reduced motion: the two stills crossfade, the room is already dimmed.
      dim.setValue(1);
      Animated.timing(closed, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      return;
    }
    closed.setValue(0);
    Animated.timing(dim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [closed, dim, inside, still]);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity: dim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.25] }) }]}
    >
      {inside ? (
        <>
          <Image source={chestSceneArt.open} style={StyleSheet.absoluteFill} blurRadius={3} />
          <Animated.View
            style={[StyleSheet.absoluteFill, { opacity: dim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
          >
            <Image source={chestSceneArt.open} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </>
      ) : null}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: closed }]}>
        <Image source={chestSceneArt.closed} style={StyleSheet.absoluteFill} />
      </Animated.View>
      {!still && !inside ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          // A texture view stays clear until its first frame, so the closed still shows through and
          // it dims with its parent. Android's default surface view punches a hole through the
          // Modal's window (the panel shows), and so does a texture view set to opacity 0.
          surfaceType="textureView"
        />
      ) : null}
      {phase === "ready" || phase === "flow" ? (
        <Lamps lamps={lamps} flowing={phase === "flow"} box={box} />
      ) : null}
    </Animated.View>
  );
}

/** One lamp per target day on the chest's brass strip; lit ones twinkle, then all flow into the lock. */
function Lamps({
  lamps,
  flowing,
  box,
}: {
  lamps: boolean[];
  flowing: boolean;
  box: { width: number; height: number };
}) {
  const reduceMotion = useReducedMotion();
  const twinkle = useRef(new Animated.Value(0)).current;
  const flows = useRef(lamps.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (reduceMotion || flowing) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(twinkle, { toValue: 0, duration: 550, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flowing, reduceMotion, twinkle]);

  useEffect(() => {
    if (!flowing) return;
    Animated.stagger(
      30,
      flows.map((value) =>
        Animated.timing(value, {
          toValue: 1,
          duration: 380,
          easing: Easing.bezier(0.5, 0, 0.75, 0),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [flowing, flows]);

  const lamp = (STRIP.bottom - STRIP.top) * 0.62 * (16 / 9) * box.width;
  const halo = lamp + 28;
  const y = ((STRIP.top + STRIP.bottom) / 2) * box.height;
  const lockX = STRIP.lock.x * box.width;
  const lockY = STRIP.lock.y * box.height;

  return (
    <>
      {lamps.map((lit, index) => {
        const x = (STRIP.left + ((index + 0.5) / lamps.length) * (STRIP.right - STRIP.left)) * box.width;
        const flow = flows[index] ?? new Animated.Value(0);
        return (
          <Animated.View
            key={index}
            style={{
              position: "absolute",
              left: x - halo / 2,
              top: y - halo / 2,
              width: halo,
              height: halo,
              opacity: flow.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              transform: [
                { translateX: flow.interpolate({ inputRange: [0, 1], outputRange: [0, lockX - x] }) },
                { translateY: flow.interpolate({ inputRange: [0, 1], outputRange: [0, lockY - y] }) },
                { scale: flow.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }) },
              ],
            }}
          >
            {lit ? (
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    opacity: twinkle.interpolate({
                      inputRange: [0, 1],
                      outputRange: index % 2 === 0 ? [0.6, 1] : [1, 0.6],
                    }),
                  },
                ]}
              >
                <Svg width={halo} height={halo}>
                  <Defs>
                    <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
                      <Stop offset={lamp / halo} stopColor="#FFD15C" stopOpacity={0.85} />
                      <Stop offset={(lamp + 12) / halo} stopColor="#FFAA28" stopOpacity={0.45} />
                      <Stop offset={1} stopColor="#FFAA28" stopOpacity={0} />
                    </RadialGradient>
                  </Defs>
                  <Circle cx={halo / 2} cy={halo / 2} r={halo / 2} fill="url(#halo)" />
                </Svg>
              </Animated.View>
            ) : null}
            <Svg width={halo} height={halo} style={StyleSheet.absoluteFill}>
              <Defs>
                {lit ? (
                  <RadialGradient id="lamp" cx="45%" cy="38%" r="60%">
                    <Stop offset={0} stopColor="#FFFBE6" />
                    <Stop offset={0.45} stopColor="#FFD15C" />
                    <Stop offset={1} stopColor="#F29B1F" />
                  </RadialGradient>
                ) : (
                  <RadialGradient id="lamp" cx="50%" cy="40%" r="60%">
                    <Stop offset={0} stopColor="#6B4A22" />
                    <Stop offset={0.7} stopColor="#3A2512" />
                  </RadialGradient>
                )}
              </Defs>
              <Circle cx={halo / 2} cy={halo / 2} r={lamp / 2} fill="url(#lamp)" />
            </Svg>
          </Animated.View>
        );
      })}
    </>
  );
}

/** "Bu haftanın emeği": the taped paper note with the week's numbers, signed by Puhu. */
function ChestNote({ chest, animate }: { chest: WeeklyChestView; animate: boolean }) {
  const t = useTranslations("panel");
  const { locale } = useLocale();
  // The mask is premium's mark, so only a premium member's Puhu signs with it.
  const premium = useIsPremium();
  const rise = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) return;
    Animated.timing(rise, {
      toValue: 1,
      duration: 700,
      easing: Easing.bezier(0.3, 0.7, 0.3, 1),
      useNativeDriver: true,
    }).start();
  }, [animate, rise]);

  // It pops up from behind the chest, overshoots and settles a little crooked.
  const steps = [0, 0.55, 0.78, 1];
  const eyebrow = chest.carriedOver ? t("chest_note_title_carried") : t("chest_note_title");

  return (
    <Animated.View
      style={[
        styles.note,
        {
          opacity: rise.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 1, 1] }),
          transform: [
            { translateY: rise.interpolate({ inputRange: steps, outputRange: [90, -12, 4, 0] }) },
            {
              rotate: rise.interpolate({
                inputRange: steps,
                outputRange: ["6deg", "-4deg", "-1deg", "-2deg"],
              }),
            },
            { scale: rise.interpolate({ inputRange: steps, outputRange: [0.8, 1.04, 0.99, 1] }) },
          ],
        },
      ]}
    >
      <View style={styles.tape} />
      <AppText style={styles.noteEyebrow}>
        {eyebrow.toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US")}
      </AppText>
      <View style={styles.noteLines}>
        {(chest.summary ? noteLines(chest.summary) : []).map((line) => (
          <View key={line.key} style={styles.noteLine}>
            <Text style={styles.hand}>{t(line.key, line.values)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.signature}>
        {premium ? (
          <Svg width={28} height={16} viewBox="1 5 22 13">
            <Path fill={C.ink} fillRule="evenodd" d={PREMIUM_MASK_OUTLINE + PREMIUM_MASK_EYES} />
          </Svg>
        ) : (
          <Svg width={40} height={16} viewBox="0 0 44 18" fill="none" stroke={C.ink} strokeWidth={2} strokeLinecap="round">
            <Circle cx={11} cy={10} r={7} />
            <Circle cx={33} cy={10} r={7} />
            <Path d="M18 9c2-2 6-2 8 0" />
          </Svg>
        )}
        <Text style={styles.sign}>{t("chest_note_sign")}</Text>
      </View>
    </Animated.View>
  );
}

/**
 * Under the note: the Coin that came with the chest (felt once, a haptic for the web's chime), the
 * grant still waiting on the earning cap, or, with the economy off, Puhu promising next Monday.
 */
function ChestReward({
  chest,
  celebrate,
  animate,
}: {
  chest: WeeklyChestView;
  celebrate: boolean;
  animate: boolean;
}) {
  const t = useTranslations("panel");
  const pop = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const reward = chest.rewardPendingMessage || !chest.reward?.amount ? null : chest.reward;
  const coin = reward?.unit === "COIN";

  useEffect(() => {
    if (celebrate && coin) haptics.success();
  }, [celebrate, coin]);

  useEffect(() => {
    if (!animate) return;
    Animated.timing(pop, {
      toValue: 1,
      delay: 450,
      duration: 420,
      easing: Easing.bezier(0.3, 0.7, 0.3, 1),
      useNativeDriver: true,
    }).start();
  }, [animate, pop]);

  if (chest.rewardPendingMessage) {
    return (
      <AppText accessibilityLiveRegion="polite" style={styles.pending}>
        {chest.rewardPendingMessage}
      </AppText>
    );
  }

  const popStyle = {
    opacity: pop.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 1, 1] }),
    transform: [{ scale: pop.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.6, 1.08, 1] }) }],
  };

  if (reward) {
    return (
      <Animated.View style={[styles.reward, popStyle]}>
        {coin ? <CoinArt size={celebrate ? 96 : 56} /> : <StarsIcon size={48} color={C.gold} />}
        <AppText style={styles.amount}>
          {coin
            ? t("quest_reward_coin", { count: reward.amount })
            : t("quest_reward_xp", { count: reward.amount })}
        </AppText>
        <AppText style={styles.rewardBody}>{t("chest_reward_body")}</AppText>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.off, popStyle]}>
      <Image source={art.puhuHappy} style={styles.offPuhu} contentFit="contain" />
      <View style={styles.bubble}>
        <View style={styles.bubbleTip} />
        <AppText style={styles.bubbleText}>{t("chest_off_bubble")}</AppText>
      </View>
    </Animated.View>
  );
}

/** The room darkens behind the text so it reads: from the top over the shelves, from the bottom on the desk. */
function Fade({ from, stops }: { from: "top" | "bottom"; stops: [number, number, number] }) {
  const [edge, middle, far] = stops;
  return (
    <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 1 1">
      <Defs>
        <LinearGradient id="fade" x1="0" y1={from === "top" ? 0 : 1} x2="0" y2={from === "top" ? 1 : 0}>
          <Stop offset={0} stopColor={C.ground} stopOpacity={edge} />
          <Stop offset={0.55} stopColor={C.ground} stopOpacity={middle} />
          <Stop offset={1} stopColor={C.ground} stopOpacity={far} />
        </LinearGradient>
      </Defs>
      <Rect width={1} height={1} fill="url(#fade)" />
    </Svg>
  );
}

function SceneButton({
  gold = false,
  label,
  onPress,
}: {
  gold?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={() => haptics.lightImpact()}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        gold ? styles.goldButton : styles.ghostButton,
        gold && { borderBottomWidth: pressed ? 2 : 5, transform: [{ translateY: pressed ? 3 : 0 }] },
      ]}
    >
      <AppText numberOfLines={1} style={[styles.buttonLabel, { color: gold ? C.goldInk : C.body }]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.ground,
  },
  art: {
    position: "absolute",
    bottom: 0,
  },
  shelfBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 48,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    color: C.title,
    textAlign: "center",
  },
  body: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: C.body,
    textAlign: "center",
  },
  deskBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 48,
    alignItems: "center",
  },
  buttons: {
    width: "100%",
    maxWidth: 320,
    gap: 12,
  },
  hidden: {
    opacity: 0,
  },
  button: {
    width: "100%",
    maxWidth: 320,
    minHeight: 48,
    borderRadius: 999,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  goldButton: {
    backgroundColor: C.gold,
    borderBottomColor: C.goldEdge,
  },
  ghostButton: {
    borderWidth: 2,
    borderColor: C.ghostLine,
  },
  buttonLabel: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
  },
  inside: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 16,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: C.body,
    textAlign: "center",
  },
  note: {
    width: "78%",
    maxWidth: 340,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: C.paper,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    boxShadow: "0 2px 4px rgba(10, 5, 0, 0.25), 0 30px 50px -22px rgba(10, 5, 0, 0.85)",
  },
  tape: {
    position: "absolute",
    alignSelf: "center",
    top: -11,
    width: 84,
    height: 22,
    borderRadius: 2,
    backgroundColor: C.tape,
    transform: [{ rotate: "-4deg" }],
  },
  noteEyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: C.eyebrow,
  },
  noteLines: {
    marginTop: 4,
  },
  // Each handwritten line sits on the note's ruled line.
  noteLine: {
    height: 34,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
  },
  hand: {
    fontFamily: HAND,
    fontSize: 29,
    lineHeight: 34,
    paddingRight: 4,
    color: C.ink,
    includeFontPadding: false,
  },
  signature: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  // Caveat leans right: a little room keeps Android from clipping the last letter.
  sign: {
    fontFamily: HAND,
    fontSize: 24,
    lineHeight: 32,
    paddingRight: 4,
    color: C.ink,
    includeFontPadding: false,
  },
  pending: {
    maxWidth: 320,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: C.body,
    textAlign: "center",
  },
  reward: {
    alignItems: "center",
  },
  amount: {
    marginTop: 4,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "900",
    color: C.gold,
  },
  rewardBody: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: C.body,
  },
  off: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    maxWidth: 340,
  },
  offPuhu: {
    width: 84,
    height: 84,
  },
  bubble: {
    flexShrink: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.paper,
  },
  bubbleTip: {
    position: "absolute",
    left: -7,
    top: "50%",
    width: 14,
    height: 14,
    marginTop: -7,
    backgroundColor: C.paper,
    transform: [{ rotate: "45deg" }],
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: C.ink,
  },
});
