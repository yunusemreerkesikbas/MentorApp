/**
 * width/height of an uploaded notebook photo — what the card placed on the page is sized from
 * (`nextEntrySlot`), so a portrait exam photo lands in a portrait slot, not a letterboxed one.
 *
 * Shared rather than local to the add panel now that the index can also place an existing entry:
 * both paths feed the same `handleCreated`, and a second copy of this would be a second answer to
 * "how tall is this card".
 */
export function measureImageAspect(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight);
    img.onerror = reject;
    img.src = url;
  });
}
