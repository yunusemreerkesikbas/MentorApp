/** Metro resolves a static image import to an asset id that `Image` accepts as `source`. */
declare module "*.png" {
  const assetId: number;
  export default assetId;
}

declare module "*.webp" {
  const assetId: number;
  export default assetId;
}

/** A local clip: `expo-video` plays the asset id as its source. */
declare module "*.mp4" {
  const assetId: number;
  export default assetId;
}

/** A bundled sound: `expo-audio` plays the asset id as its source. */
declare module "*.mp3" {
  const assetId: number;
  export default assetId;
}
