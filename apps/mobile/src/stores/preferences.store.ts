import { create } from "zustand";
import {
  resolveEffectiveTheme,
  type AppLocale,
  type PreferencesState,
  type ThemePreference,
} from "./preferences.js";

export { resolveEffectiveTheme, type AppLocale, type PreferencesState, type ThemePreference };

export const usePreferencesStore = create<PreferencesState>((set) => ({
  locale: "tr",
  themePreference: "light",
  onboardingCompleted: false,
  setLocale: (locale) => set({ locale }),
  setThemePreference: (themePreference) => set({ themePreference }),
  setOnboardingCompleted: (onboardingCompleted) => set({ onboardingCompleted }),
}));
