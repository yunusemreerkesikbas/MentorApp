export const APP_SIDEBAR_COOKIE = "mentor-sidebar";
export const APP_SIDEBAR_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
export const APP_SIDEBAR_CHANGE_EVENT = "mentor-sidebar-change";
export const APP_SIDEBAR_COLLAPSED_VALUE = "collapsed";

/** Desktop expanded rail — Tailwind `w-60`. */
export const APP_SIDEBAR_EXPANDED_PX = 240;
/** Icon strip — same width as analysis / coach history rails. */
export const APP_SIDEBAR_COLLAPSED_PX = 52;

export const DEFAULT_APP_SIDEBAR_OPEN = true;

/** Canonical `/vision-board/board` or public `/hedef/pano` (optional locale prefix). */
export function isBoardEditorPath(pathname: string): boolean {
  return /(?:^|\/)(?:vision-board\/board|hedef\/pano)\/?$/.test(pathname);
}

/**
 * Blocking bootstrap — runs before paint so `--app-sidebar-width` matches the
 * cookie and the first frame is not an expanded flash. Keep in sync with
 * `parseAppSidebarCookie`. `/hedef/pano` always starts collapsed (no cookie write).
 */
export const APP_SIDEBAR_BOOTSTRAP_SCRIPT = `(function(){try{var p=location.pathname;var board=/(?:^|\\/)(?:vision-board\\/board|hedef\\/pano)\\/?$/.test(p);var m=document.cookie.match(/(?:^|; )${APP_SIDEBAR_COOKIE}=([^;]*)/);if(board||(m&&decodeURIComponent(m[1])==="${APP_SIDEBAR_COLLAPSED_VALUE}"))document.documentElement.dataset.appSidebar="${APP_SIDEBAR_COLLAPSED_VALUE}"}catch(e){}})();`;

export function parseAppSidebarCookie(
  cookieSource: string | null | undefined,
): boolean {
  if (!cookieSource) return DEFAULT_APP_SIDEBAR_OPEN;
  const match = cookieSource.match(/(?:^|;\s*)mentor-sidebar=([^;]*)/);
  if (!match?.[1]) return DEFAULT_APP_SIDEBAR_OPEN;
  try {
    return decodeURIComponent(match[1]) !== APP_SIDEBAR_COLLAPSED_VALUE;
  } catch {
    return DEFAULT_APP_SIDEBAR_OPEN;
  }
}

export function writeAppSidebar(open: boolean): void {
  const value = open ? "expanded" : APP_SIDEBAR_COLLAPSED_VALUE;
  document.cookie = `${APP_SIDEBAR_COOKIE}=${value}; Path=/; Max-Age=${APP_SIDEBAR_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function applyAppSidebar(open: boolean): void {
  if (open) {
    delete document.documentElement.dataset.appSidebar;
  } else {
    document.documentElement.dataset.appSidebar = APP_SIDEBAR_COLLAPSED_VALUE;
  }
  window.dispatchEvent(new Event(APP_SIDEBAR_CHANGE_EVENT));
}

export function subscribeAppSidebar(onStoreChange: () => void) {
  window.addEventListener(APP_SIDEBAR_CHANGE_EVENT, onStoreChange);
  return () => window.removeEventListener(APP_SIDEBAR_CHANGE_EVENT, onStoreChange);
}

export function getAppSidebarSnapshot(): boolean {
  return document.documentElement.dataset.appSidebar !== APP_SIDEBAR_COLLAPSED_VALUE;
}

export function getAppSidebarServerSnapshot(): boolean {
  return DEFAULT_APP_SIDEBAR_OPEN;
}
