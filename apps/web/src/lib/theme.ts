export const THEME_COOKIE = "mentor-theme";
export const THEME_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
export const THEME_CHANGE_EVENT = "mentor-theme-change";
export const DEFAULT_THEME = "light" as const;

export type Theme = "light" | "dark";

/**
 * Blocking bootstrap — runs before paint so `html.dark` matches the cookie
 * and the first frame is not a light flash. Keep in sync with `parseThemeCookie`.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);if(m&&decodeURIComponent(m[1])==="dark")document.documentElement.classList.add("dark")}catch(e){}})();`;

export function parseThemeCookie(cookieSource: string | null | undefined): Theme {
  if (!cookieSource) return DEFAULT_THEME;
  const match = cookieSource.match(/(?:^|;\s*)mentor-theme=([^;]*)/);
  if (!match?.[1]) return DEFAULT_THEME;
  try {
    return decodeURIComponent(match[1]) === "dark" ? "dark" : "light";
  } catch {
    return DEFAULT_THEME;
  }
}

export function readTheme(): Theme {
  if (typeof document === "undefined") return DEFAULT_THEME;
  return parseThemeCookie(document.cookie);
}

export function writeTheme(theme: Theme): void {
  document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${THEME_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}
