import { createHmac, timingSafeEqual } from "node:crypto";
import type { StorageReadActor } from "./storage-budget.types";

export const MEDIA_SESSION_COOKIE = "mentor_media_session";
export const PRIVATE_MEDIA_PATH = "/v1/storage/media/private";

export function signMediaSession(actor: StorageReadActor, secret: string): string {
  return createHmac("sha256", secret)
    .update(`media-session:v1:${actor.userId}:${actor.sessionId}`)
    .digest("base64url");
}

export function matchesMediaSession(value: unknown, actor: StorageReadActor, secret: string): boolean {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value) &&
    timingSafeEqual(Buffer.from(value), Buffer.from(signMediaSession(actor, secret)));
}
