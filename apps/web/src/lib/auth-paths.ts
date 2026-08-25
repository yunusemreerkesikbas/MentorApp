/** Internal next-intl pathnames for the `(auth)` route group. */
export const AUTH_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
] as const;

const AUTH_PATH_SET = new Set<string>(AUTH_PATHS);
const CLOSE_PATHS = new Set<string>(["/login", "/signup"]);

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATH_SET.has(pathname);
}

export function authShellNav(pathname: string): {
  href: "/" | "/login";
  icon: "close" | "chevron";
} {
  if (CLOSE_PATHS.has(pathname)) {
    return { href: "/", icon: "close" };
  }
  return { href: "/login", icon: "chevron" };
}
