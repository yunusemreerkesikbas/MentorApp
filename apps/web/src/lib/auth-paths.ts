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

/** Hang-Puhu sits on the login and signup sheets. */
export function authShellShowsHang(pathname: string): boolean {
  return pathname === "/login" || pathname === "/signup";
}
