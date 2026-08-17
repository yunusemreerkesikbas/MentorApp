"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  DEFAULT_THEME,
  THEME_CHANGE_EVENT,
  applyTheme,
  type Theme,
  writeTheme,
} from "./theme";

function subscribe(onStoreChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => {
    writeTheme(next);
    applyTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    const next: Theme = document.documentElement.classList.contains("dark")
      ? "light"
      : "dark";
    writeTheme(next);
    applyTheme(next);
  }, []);

  return { theme, setTheme, toggleTheme };
}
