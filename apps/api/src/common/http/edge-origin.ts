import { isIP } from "node:net";
import type { ConfigService } from "@nestjs/config";
import type { Request, RequestHandler } from "express";
import type { Env } from "../../config/env.validation";
import { secretEqual } from "../auth/secret-equal";
import trErrors from "../../i18n/locales/tr/errors.json";
import enErrors from "../../i18n/locales/en/errors.json";

function directOriginException(req: Request, cronSecret: string | undefined): boolean {
  if (req.method === "GET" && /^\/v1\/health(?:\/ready)?\/?$/.test(req.path)) return true;
  if (req.method !== "POST" || !/^\/v1\/internal\/cron\/[a-z0-9-]+\/?$/.test(req.path)) return false;
  const provided = req.header("x-cron-secret") ?? req.header("authorization")?.replace(/^Bearer\s+/i, "");
  return secretEqual(provided, cronSecret);
}

/** Install before body parsers. Do not enable Express trust proxy or trust X-Forwarded-For. */
export function edgeOriginMiddleware(config: ConfigService<Env, true>): RequestHandler {
  const production = config.get("NODE_ENV", { infer: true }) === "production";
  const secret = config.get("EDGE_ORIGIN_SECRET", { infer: true });
  const cronSecret = config.get("CRON_SECRET", { infer: true });
  return (req, res, next) => {
    let ip = req.socket.remoteAddress;
    if (production && !directOriginException(req, cronSecret)) {
      const connectingIp = req.headers["cf-connecting-ip"];
      if (!secretEqual(req.header("x-mentor-origin-secret"), secret) ||
          typeof connectingIp !== "string" || connectingIp.includes("%") || isIP(connectingIp) === 0) {
        res.status(403).json({ code: "FORBIDDEN", message: req.acceptsLanguages("tr", "en") === "en"
          ? enErrors.FORBIDDEN : trErrors.FORBIDDEN });
        return;
      }
      // Normalize equivalent IPv6 spellings so they cannot create separate rate buckets.
      ip = isIP(connectingIp) === 6 ? new URL(`http://[${connectingIp}]/`).hostname.slice(1, -1) : connectingIp;
    }
    Object.defineProperty(req, "ip", { value: ip, configurable: true });
    next();
  };
}
