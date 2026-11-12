/** Metro resolves a static image import to an asset id that `Image` accepts as `source`. */
declare module "*.png" {
  const assetId: number;
  export default assetId;
}

declare module "*.webp" {
  const assetId: number;
  export default assetId;
}
