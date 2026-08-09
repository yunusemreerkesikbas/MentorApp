export function relativeTime(iso: string, locale = "tr"): string {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  const isTurkish = locale.toLowerCase().startsWith("tr");

  if (elapsedSeconds < 60) return isTurkish ? "şimdi" : "now";
  if (elapsedSeconds < 3_600) return `${Math.floor(elapsedSeconds / 60)}${isTurkish ? "dk" : "m"}`;
  if (elapsedSeconds < 86_400) return `${Math.floor(elapsedSeconds / 3_600)}${isTurkish ? "s" : "h"}`;
  if (elapsedSeconds < 604_800) return `${Math.floor(elapsedSeconds / 86_400)}${isTurkish ? "g" : "d"}`;
  if (elapsedSeconds < 2_592_000) return `${Math.floor(elapsedSeconds / 604_800)}${isTurkish ? "hf" : "w"}`;
  if (elapsedSeconds < 31_536_000) return `${Math.floor(elapsedSeconds / 2_592_000)}${isTurkish ? "ay" : "mo"}`;
  return `${Math.floor(elapsedSeconds / 31_536_000)}${isTurkish ? "y" : "yr"}`;
}
