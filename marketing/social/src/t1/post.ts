import { SCENES, type SceneId } from "./timeline";

// T1P, the 4:5 post: the 9:16 film seen through a 1350 px window. Each scene sets the window's top (px from the
// film's top) so its words and Puhu stay in; most scenes keep the top band of words from y ≈ 250.
export const POST_TOP: Record<SceneId, number> = {
  "01": 200, "02": 380, "03": 110, "04": 255, "05": 240, "06": 240, "07": 240, "08": 240, "09": 240,
  "10": 240, "11": 240, "12": 240, "13": 240, "14": 240, "15": 250, "16": 240, "17": 250,
};

// ponytail: the window jumps at each cut (no pan); the cuts already hide it.
export const postTop = (frame: number): number => POST_TOP[[...SCENES].reverse().find((s) => frame >= s.from)!.id];
