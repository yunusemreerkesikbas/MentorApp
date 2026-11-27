import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import type { WELCOME_SCENES } from "../../lib/onboarding-assets.js";

type Scene = (typeof WELCOME_SCENES)[number];

/**
 * The web's `WelcomeScene`: the clip plays from the top each time its slide becomes active and holds
 * on the last frame. The first-frame poster sits under it until it draws, and stays if the clip
 * cannot play. Reduced motion shows the end state as a still.
 */
export function WelcomeScene({ scene, active, still }: { scene: Scene; active: boolean; still: boolean }) {
  // Only the active slide holds a decoder; the others show the poster (its first frame), so a
  // low-end phone never decodes four clips at once.
  const playing = active && !still;
  const player = useVideoPlayer(playing ? scene.video : null, (created) => {
    created.muted = true;
    created.loop = false;
  });
  const [failed, setFailed] = useState(false);
  // The texture view is black until the clip draws; the poster shows through until then.
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (!playing) setDrawn(false);
  }, [playing]);

  useEffect(() => {
    if (!playing) return;
    const subscription = player.addListener("statusChange", ({ status }) => setFailed(status === "error"));
    return () => subscription.remove();
  }, [player, playing]);

  useEffect(() => {
    if (!playing || failed) return;
    player.currentTime = 0;
    player.play();
  }, [failed, player, playing]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: scene.tint }]}>
      <Image source={still ? scene.end : scene.start} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
      {!playing || failed ? null : (
        <VideoView player={player} onFirstFrameRender={() => setDrawn(true)} style={[StyleSheet.absoluteFill, { opacity: drawn ? 1 : 0 }]} contentFit="cover" nativeControls={false} surfaceType="textureView" />
      )}
    </View>
  );
}
