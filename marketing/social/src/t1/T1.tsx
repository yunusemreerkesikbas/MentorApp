import { Audio } from "@remotion/media";
import { Sequence, staticFile, Track } from "remotion";
import { SOUND } from "../art";
import { C } from "../brand";
import { Frame } from "../components/Frame";
import type { PieceProps } from "../pieces";
import { Flash } from "./parts/Flash";
import { S01 } from "./scenes/S01";
import { S02 } from "./scenes/S02";
import { S03 } from "./scenes/S03";
import { S04 } from "./scenes/S04";
import { S05 } from "./scenes/S05";
import { S06 } from "./scenes/S06";
import { S07 } from "./scenes/S07";
import { S08 } from "./scenes/S08";
import { S09 } from "./scenes/S09";
import { S10 } from "./scenes/S10";
import { S11 } from "./scenes/S11";
import { S12 } from "./scenes/S12";
import { S13 } from "./scenes/S13";
import { S14 } from "./scenes/S14";
import { S15 } from "./scenes/S15";
import { S16 } from "./scenes/S16";
import { S17 } from "./scenes/S17";
import { CUES, cueFrame, levelGain, MUSIC_VOLUME, SFX } from "./sfx";
import { sceneOf, type SceneId } from "./timeline";

// ponytail: scene timing comes from timeline.ts (one tested source), so Studio drags don't write back.
const at = (id: SceneId) => ({ from: sceneOf(id).from, durationInFrames: sceneOf(id).durationInFrames });

// "Ekrana dalış": 17 scenes on one track, the Igloo cut underneath.
export function T1({ safe }: PieceProps) {
  return (
    <Frame format="reel" background={C.blue} safe={safe}>
      <Track name="Sahneler">
        <Sequence name="01 · Kanca" {...at("01")}><S01 /></Sequence>
        <Sequence name="02 · Bildirim" {...at("02")}><S02 /></Sequence>
        <Sequence name="03 · K1 dalış" {...at("03")}><S03 /></Sequence>
        <Sequence name="04 · Sınavlar" {...at("04")}><S04 /></Sequence>
        <Sequence name="05 · Albüm" {...at("05")}><S05 /></Sequence>
        <Sequence name="06 · Pano" {...at("06")}><S06 /></Sequence>
        <Sequence name="07 · Şehrin üstünde" {...at("07")}><S07 /></Sequence>
        <Sequence name="08 · Ekranlar" {...at("08")}><S08 /></Sequence>
        <Sequence name="09 · Odalar" {...at("09")}><S09 /></Sequence>
        <Sequence name="10 · Puhu'nun odası" {...at("10")}><S10 /></Sequence>
        <Sequence name="11 · Defter" {...at("11")}><S11 /></Sequence>
        <Sequence name="12 · Masa" {...at("12")}><S12 /></Sequence>
        <Sequence name="13 · Topluluk" {...at("13")}><S13 /></Sequence>
        <Sequence name="14 · Sandık" {...at("14")}><S14 /></Sequence>
        <Sequence name="15 · Lakap" {...at("15")}><S15 /></Sequence>
        <Sequence name="16 · Senin odan" {...at("16")}><S16 /></Sequence>
        <Sequence name="17 · Final" {...at("17")}><S17 /></Sequence>
      </Track>
      <Track name="Geçişler">
        {/* 1: the camera follows Puhu into the screen; the white peaks over the 03 → 04 cut. */}
        <Sequence name="Beyaz flaş 03→04" from={sceneOf("04").from - 5} durationInFrames={15}><Flash /></Sequence>
      </Track>
      {/* Not a <Track>: effects overlap (the dial clicks two frames apart), which a Track refuses. */}
      <Sequence name="Efektler" layout="none">
        {CUES.map((c) => (
          // ponytail: every trimmed effect fits in 2 s (the chime only loses its last frame of tail)
          <Sequence key={c.name} name={c.name} from={cueFrame(c) - SFX[c.sound].hit} durationInFrames={60} layout="none">
            <Audio src={staticFile(SOUND[c.sound])} volume={c.mix * levelGain(c.sound)} trimBefore={SFX[c.sound].trim} />
          </Sequence>
        ))}
      </Sequence>
      <Audio name="Müzik" src={staticFile(SOUND.t1Music)} volume={MUSIC_VOLUME} />
    </Frame>
  );
}
