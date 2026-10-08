import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { contentSecurityPolicy } from "./lib/content-security-policy";

const localeMiddleware = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const nonce = randomBytes(16).toString("base64");
  const policy = contentSecurityPolicy(nonce, {
    production: process.env.NODE_ENV === "production",
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
    storageOrigins: process.env.WEB_CSP_STORAGE_ORIGINS,
  });
  const headers = new Headers(request.headers);
  // Next uses the request CSP for framework nonces; never accept visitor-provided values.
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", policy);
  headers.delete("content-security-policy-report-only");
  const response = localeMiddleware(new NextRequest(request, { headers }));
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("CDN-Cache-Control", "no-store");
  response.headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  if (request.nextUrl.searchParams.has("token") ||
      /\/(reset-password|verify-email|sifre-sifirla|eposta-dogrula)(\/|$)/.test(request.nextUrl.pathname)) {
    response.headers.set("Referrer-Policy", "no-referrer");
  }
  return response;
}

export const config = {
  // Keep dotted page slugs protected. Public assets live in these explicit namespaces.
  // Prefetch/RSC requests also need trusted nonce headers for dynamic rendering.
  matcher: ["/((?!(?:api|_next|_vercel|cdn-cgi|img|mascot|visuals|video|audio|animation|lottie|achievements|leaderboard)(?:/|$)|(?:favicon\\.ico|sw\\.js|manifest\\.(?:json|webmanifest)|robots\\.txt|sitemap\\.xml|icon-credits\\.txt)$).*)"],
};
