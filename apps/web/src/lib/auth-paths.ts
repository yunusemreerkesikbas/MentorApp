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

export function authShellNav(pathname: string): {
  href: "/" | "/login";
  icon: "chevron" | "none";
} {
  if (pathname === "/login" || pathname === "/signup") {
    return { href: "/", icon: "none" };
  }
  return { href: "/login", icon: "chevron" };
}
