export function formatDisplayDate(
  iso: string,
  locale: "tr" | "en",
  timeZone: "Europe/Istanbul" | "UTC" = "Europe/Istanbul",
): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "tr-TR", {
    timeZone,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
