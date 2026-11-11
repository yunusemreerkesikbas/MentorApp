import type { ThemeMode } from "@mentor/ui/tokens";

export type AppLocale = "tr" | "en";
export type ThemePreference = ThemeMode | "system";

export interface PreferencesState {
  locale: AppLocale;
  themePreference: ThemePreference;
  onboardingCompleted: boolean;
  setLocale: (locale: AppLocale) => void;
  setThemePreference: (pref: ThemePreference) => void;
  setOnboardingCompleted: (done: boolean) => void;
}

export function resolveEffectiveTheme(
  preference: ThemePreference,
  systemScheme: "light" | "dark" | null | undefined,
): ThemeMode {
  if (preference === "light" || preference === "dark") return preference;
  return systemScheme === "dark" ? "dark" : "light";
}
