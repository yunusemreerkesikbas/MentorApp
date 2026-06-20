import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for
  // - /api/ routes
  // - /_next/ (Next.js internals)
  // - /favicon.ico, /sw.js, /manifest.json, etc. (static files)
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
