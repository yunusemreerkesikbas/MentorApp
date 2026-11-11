import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import {
  darkThemeTokens,
  ledgeTokens,
  lightThemeTokens,
  motionTokens,
  radii,
  sceneThemes,
  spaceScale,
  touchTargets,
  typeScale,
  type ThemeMode,
  type ThemePalette,
} from "@mentor/ui/tokens";
import {
  resolveEffectiveTheme,
  usePreferencesStore,
  type ThemePreference,
} from "../stores/preferences.store.js";

export interface ThemeContextValue {
  readonly mode: ThemeMode;
  readonly preference: ThemePreference;
  readonly palette: ThemePalette;
  readonly radii: typeof radii;
  readonly space: typeof spaceScale;
  readonly touchTargets: typeof touchTargets;
  readonly ledge: typeof ledgeTokens;
  readonly typeScale: typeof typeScale;
  readonly motion: typeof motionTokens;
  readonly scenes: typeof sceneThemes;
  setThemePreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const preference = usePreferencesStore((s) => s.themePreference);
  const setThemePreference = usePreferencesStore((s) => s.setThemePreference);
  const mode = resolveEffectiveTheme(preference, systemScheme);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      preference,
      palette: mode === "dark" ? darkThemeTokens : lightThemeTokens,
      radii,
      space: spaceScale,
      touchTargets,
      ledge: ledgeTokens,
      typeScale,
      motion: motionTokens,
      scenes: sceneThemes,
      setThemePreference,
    }),
    [mode, preference, setThemePreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeTokens(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeTokens must be used within <ThemeProvider>");
  }
  return ctx;
}
