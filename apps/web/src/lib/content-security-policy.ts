interface PolicyOptions {
  production: boolean;
  apiUrl?: string;
  storageOrigins?: string;
}

function origin(value: string, allowPath: boolean): string {
  if (/[\s;*]/.test(value)) throw new Error("Invalid CSP origin configuration");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Invalid CSP origin configuration"); }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash ||
      (!allowPath && url.pathname !== "/") ||
      (url.protocol !== "https:" && !(allowPath && url.protocol === "http:" && loopback))) {
    throw new Error("Invalid CSP origin configuration");
  }
  return url.origin;
}

/** One document policy across public/authenticated navigation. No external violation reports. */
export function contentSecurityPolicy(nonce: string, options: PolicyOptions): string {
  if (!/^[A-Za-z0-9+/]{22}==$/.test(nonce)) throw new Error("Invalid document nonce");
  const apiUrl = options.apiUrl?.trim() || (!options.production ? "http://localhost:3001/v1" : undefined);
  if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL is required for production CSP");
  const apiOrigin = origin(apiUrl, true);
  const storage = [...new Set((options.storageOrigins ?? "").split(",").map((entry) => entry.trim()).filter(Boolean).map((entry) => origin(entry, false)))];
  const maps = "https://*.googleapis.com https://*.gstatic.com https://*.google.com";
  const ads = "https://*.googlesyndication.com https://*.doubleclick.net";
  const analytics = "https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com";
  return [
    "default-src 'self'",
    // WASM is needed by the existing DotLottie runtime; JavaScript eval remains forbidden.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${options.production ? "" : " 'unsafe-eval'"}`,
    "script-src-attr 'none'",
    // ponytail: React style props and provider-injected styles still need inline CSS.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `img-src 'self' data: blob: ${[apiOrigin, ...storage].join(" ")} ${maps} https://*.googleusercontent.com ${ads} ${analytics}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src 'self' ${[apiOrigin, ...storage].join(" ")} https://challenges.cloudflare.com ${maps} ${ads} ${analytics} https://cdn.jsdelivr.net/npm/@lottiefiles/ https://unpkg.com/@lottiefiles/${options.production ? "" : " ws://localhost:* ws://127.0.0.1:*"}`,
    `frame-src https://challenges.cloudflare.com https://*.google.com ${ads}`,
    "worker-src 'self' blob:",
    `media-src 'self' data: blob: ${storage.join(" ")}`.trim(),
    "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'",
    ...(options.production ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
