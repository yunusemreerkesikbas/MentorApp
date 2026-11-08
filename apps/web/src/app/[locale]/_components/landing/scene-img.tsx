import type { CSSProperties, ImgHTMLAttributes } from "react";

/** Every scene file ships as AVIF (about half the bytes) next to the WebP it falls back to. */
const avif = (webp: string) => webp.replace(/\.webp$/, ".avif");

export function SceneImg({ src, mobileSrc, ...img }: { src: string; mobileSrc?: string } & Omit<ImgHTMLAttributes<HTMLImageElement>, "src">) {
  return (
    <picture>
      {mobileSrc && <source media="(max-width: 767px)" type="image/avif" srcSet={avif(mobileSrc)} />}
      {mobileSrc && <source media="(max-width: 767px)" type="image/webp" srcSet={mobileSrc} />}
      <source type="image/avif" srcSet={avif(src)} />
      <img src={src} alt="" decoding="async" {...img} />
    </picture>
  );
}

/** A CSS background with the same AVIF-then-WebP choice, for art that must not load until shown. */
export function sceneBackground(webp: string): CSSProperties {
  return { backgroundImage: `image-set(url(${avif(webp)}) type("image/avif"), url(${webp}) type("image/webp"))` };
}
