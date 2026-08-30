export function advanceTopBannerIndex(currentIndex: number, itemCount: number): number {
  if (itemCount <= 0) return 0;
  if (itemCount === 1) return 0;
  return (currentIndex + 1) % itemCount;
}
