export function getProfileLevelWindow(
  currentTier: number,
  maximumTier: number,
): [number | null, number, number | null] {
  return [
    currentTier > 1 ? currentTier - 1 : null,
    currentTier,
    currentTier < maximumTier ? currentTier + 1 : null,
  ];
}
