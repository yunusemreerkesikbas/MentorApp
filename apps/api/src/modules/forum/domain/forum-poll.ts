/** Largest-remainder percentages. Equal remainders are resolved by stable option order. */
export function calculatePollPercentages(voteCounts: number[]): number[] {
  const total = voteCounts.reduce((sum, count) => sum + count, 0);
  if (total === 0) return voteCounts.map(() => 0);

  const exact = voteCounts.map((count) => (count * 100) / total);
  const result = exact.map(Math.floor);
  let remaining = 100 - result.reduce((sum, percentage) => sum + percentage, 0);
  const ranked = exact
    .map((percentage, index) => ({ index, remainder: percentage - Math.floor(percentage) }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);

  for (const entry of ranked) {
    if (remaining === 0) break;
    result[entry.index] = (result[entry.index] ?? 0) + 1;
    remaining -= 1;
  }
  return result;
}
