export type GreetingKey = "greeting_morning" | "greeting_day" | "greeting_evening";

/** Part of the local day; each surface keeps the copy in its own namespace. */
export function greetingKeyForHour(hour = new Date().getHours()): GreetingKey {
  if (hour < 12) return "greeting_morning";
  if (hour < 18) return "greeting_day";
  return "greeting_evening";
}

/** "Selin Kaya" → "Selin": a greeting uses the first name, like a person would. */
export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || displayName;
}
