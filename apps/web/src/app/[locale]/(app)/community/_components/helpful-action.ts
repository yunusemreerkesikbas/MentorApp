export function getHelpfulActionPresentation({
  count,
  accessibleLabel,
  unavailableLabel,
  canVote = true,
}: {
  count: number;
  accessibleLabel: string;
  unavailableLabel?: string;
  canVote?: boolean;
}) {
  return {
    visibleCount: String(count),
    ariaLabel:
      !canVote && unavailableLabel
        ? `${unavailableLabel}. ${accessibleLabel}: ${count}`
        : `${accessibleLabel}: ${count}`,
  };
}
