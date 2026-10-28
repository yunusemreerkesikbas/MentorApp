/**
 * Where everything sits in the city, measured on the approved canvas. Coordinates are px inside a
 * layer's own 2400×1400 box (see city-camera.ts); the art files are in public/visuals/landing.
 */

/** Scroll length of one stop. The anchors and the track height both use it, so `#durak-N` lands on stop N. */
export const STOP_SCROLL_SVH = 110;

export interface SceneArt {
  src: string;
  left: number;
  top: number;
  width: number;
  /** The file's own size, for the aspect ratio. */
  naturalWidth: number;
  naturalHeight: number;
}

export const FAR: SceneArt = { src: "/visuals/landing/city-far.webp", left: -360, top: -516, width: 2400, naturalWidth: 1536, naturalHeight: 1024 };
export const MID: SceneArt = { src: "/visuals/landing/city-mid.webp", left: -11, top: 264, width: 1800, naturalWidth: 1536, naturalHeight: 1024 };
export const FACADE: SceneArt = { src: "/visuals/landing/city-facade.webp", left: 831, top: 34, width: 737, naturalWidth: 1024, naturalHeight: 1536 };
export const FRONT: SceneArt = { src: "/visuals/landing/city-front.webp", left: 109, top: 242, width: 1600, naturalWidth: 1536, naturalHeight: 1024 };

/** How much each layer follows the camera: far, mid, the building, the foreground. */
export const LAYER_DEPTHS = [0.25, 0.6, 1, 1.5] as const;
/** On a portrait screen the foreground would cover the building's lower floors, so it sits lower. */
export const FRONT_LIFT_TALL = 260;

export interface SceneWindow {
  stop: number;
  room: "puhu" | "koc" | "plan" | "masa" | "topluluk" | "analiz";
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The lit windows the story visits. The top-middle window (1132, 336) is the visitor's own and stays
 * dark until the career picker lights it; the middle of the second floor is only art; the door is flat 5.
 */
export const WINDOWS: readonly SceneWindow[] = [
  { stop: 1, room: "puhu", left: 948, top: 336, width: 134, height: 119 },
  { stop: 2, room: "koc", left: 1323, top: 336, width: 134, height: 119 },
  { stop: 3, room: "plan", left: 948, top: 565, width: 134, height: 127 },
  { stop: 4, room: "masa", left: 1323, top: 565, width: 134, height: 127 },
  { stop: 5, room: "topluluk", left: 948, top: 812, width: 134, height: 127 },
  { stop: 6, room: "analiz", left: 1323, top: 812, width: 134, height: 127 },
];

/** The visitor's window (flat 2), dark in the art. The career picker lights it with their room and Puhu. */
export const YOURS_WINDOW = { left: 1132, top: 336, width: 134, height: 119 } as const;

/** The doorbell panel: flat number, its message key, and the stop its window is. */
export const BELLS = [
  { no: 1, key: "puhu", stop: 1 },
  { no: 2, key: "yours", stop: 7 },
  { no: 3, key: "coach", stop: 2 },
  { no: 4, key: "plan", stop: 3 },
  { no: 6, key: "desk", stop: 4 },
  { no: 7, key: "community", stop: 5 },
  { no: 8, key: "analysis", stop: 6 },
] as const;
