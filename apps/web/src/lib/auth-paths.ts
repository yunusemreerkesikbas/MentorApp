/** Internal next-intl pathnames for the `(auth)` route group. */
export const AUTH_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
] as const;

const AUTH_PATH_SET = new Set<string>(AUTH_PATHS);

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATH_SET.has(pathname);
}

/** Login/signup have no header control; nested auth screens go back to login. */
export function authShellShowsBack(pathname: string): boolean {
  return pathname !== "/login" && pathname !== "/signup";
}

/** Mobile keeps Hang-Puhu on login/signup; desktop shows it on every auth card. */
export function authShellShowsHang(pathname: string): boolean {
  return pathname === "/login" || pathname === "/signup";
}
