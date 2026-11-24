import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import {
  resolveEffectiveTheme,
  type AppLocale,
  type PreferencesState,
  type ThemePreference,
} from "./preferences.js";

export { resolveEffectiveTheme, type AppLocale, type PreferencesState, type ThemePreference };

// ponytail: two short strings in SecureStore because it is the only storage already installed
// and its sync API lets the first frame render with the saved theme. Move to a plain key-value
// store if preferences grow beyond a handful of fields.
const STORAGE_KEY = "mentor.prefs.v1";

type SavedPreferences = Pick<PreferencesState, "locale" | "themePreference">;

function loadSaved(): Partial<SavedPreferences> {
  try {
    const raw = SecureStore.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { locale?: unknown; themePreference?: unknown };
    const saved: Partial<SavedPreferences> = {};
    if (parsed.locale === "tr" || parsed.locale === "en") saved.locale = parsed.locale;
    if (
      parsed.themePreference === "light" ||
      parsed.themePreference === "dark" ||
      parsed.themePreference === "system"
    ) {
      saved.themePreference = parsed.themePreference;
    }
    return saved;
  } catch {
    return {};
  }
}

function save(next: SavedPreferences): void {
  try {
    SecureStore.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A failed write only costs the preference on the next launch.
  }
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  locale: "tr",
  themePreference: "light",
  onboardingCompleted: false,
  ...loadSaved(),
  setLocale: (locale) => {
    set({ locale });
    save({ locale, themePreference: get().themePreference });
  },
  setThemePreference: (themePreference) => {
    set({ themePreference });
    save({ locale: get().locale, themePreference });
  },
  setOnboardingCompleted: (onboardingCompleted) => set({ onboardingCompleted }),
}));
