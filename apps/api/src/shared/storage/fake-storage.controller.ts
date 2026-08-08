import { Controller, Get, Put, Query, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import type { Env } from "../../config/env.validation";
import { Public } from "../../common/auth/public.decorator";
import { FakeStorageAdapter } from "../adapters/storage/fake-storage.adapter";
import { PHOTO_ALLOWED_MIME, PHOTO_MAX_BYTES } from "../../modules/ai/domain/photo-classify.constants";
import { AVATAR_ALLOWED_MIME, AVATAR_MAX_BYTES } from "../../modules/identity/domain/avatar";
import {
  FORUM_FILE_MAX_BYTES,
  FORUM_FILE_MIME,
  FORUM_IMAGE_MIME,
} from "../../modules/forum/domain/attachment.constants";
import {
  VISION_BOARD_IMAGE_MAX_BYTES,
  VISION_BOARD_IMAGE_MIMES,
} from "@mentor/validation";
import {
  ARTICLE_IMAGE_MAX_BYTES,
  ARTICLE_IMAGE_MIMES,
} from "../../modules/content/domain/content.constants";

/** Forum accepts images + files; the authoritative per-kind size cap is enforced in resolveForumAttachments. */
const FORUM_ATTACHMENT_MIME = new Set([...FORUM_IMAGE_MIME, ...FORUM_FILE_MIME]);

/**
 * Per-resource size + mime rules, keyed by the object's prefix.
 *
 * Prefixes come from `storage-prefixes.ts` — the same list the R2 adapter routes on — so a new
 * upload feature cannot be accepted here while being rejected there (which is exactly how forum
 * attachments ended up broken under R2 while working in dev).
 */
function limitsForKey(key: string): { maxBytes: number; allowedMime: Set<string> } {
  if (key.startsWith("avatars/")) {
    return { maxBytes: AVATAR_MAX_BYTES, allowedMime: AVATAR_ALLOWED_MIME };
  }
  if (key.startsWith("forum-attachments/")) {
    return { maxBytes: FORUM_FILE_MAX_BYTES, allowedMime: FORUM_ATTACHMENT_MIME };
  }
  if (key.startsWith("content/")) {
    return {
      maxBytes: ARTICLE_IMAGE_MAX_BYTES,
      allowedMime: new Set(ARTICLE_IMAGE_MIMES),
    };
  }
  if (key.startsWith("vision-board/")) {
    return {
      maxBytes: VISION_BOARD_IMAGE_MAX_BYTES,
      allowedMime: new Set(VISION_BOARD_IMAGE_MIMES),
    };
  }
  // `mock-exams/` — the private prefix, and the only one left.
  return { maxBytes: PHOTO_MAX_BYTES, allowedMime: PHOTO_ALLOWED_MIME };
}

/**
 * Dev/test fake storage endpoints — only used when STORAGE_PROVIDER=fake.
 */
@ApiExcludeController()
@ApiTags("storage")
@Controller("storage")
export class FakeStorageController {
  constructor(
    private readonly fake: FakeStorageAdapter,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private enabled(): boolean {
    return (
      this.config.get("STORAGE_PROVIDER", { infer: true }) === "fake" &&
      this.config.get("NODE_ENV", { infer: true }) !== "production"
    );
  }

  @Public()
  @Put("fake-upload")
  async fakeUpload(
    @Query("key") key: string,
    @Query("contentType") contentType: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!this.enabled()) {
      res.status(404).send("not found");
      return undefined;
    }
    if (!key || !contentType) {
      res.status(400).send("key and contentType required");
      return undefined;
    }
    const { maxBytes, allowedMime } = limitsForKey(key);
    if (!allowedMime.has(contentType)) {
      res.status(400).send("unsupported contentType");
      return undefined;
    }
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).send("empty body");
      return undefined;
    }
    if (body.length > maxBytes) {
      res.status(413).send("too large");
      return undefined;
    }
    await this.fake.putObject(key, body, contentType);
    res.status(200).send("ok");
  }

  @Public()
  @Get("fake-object")
  async fakeObject(@Query("key") key: string, @Res() res: Response): Promise<void> {
    if (!this.enabled()) {
      res.status(404).send("not found");
      return;
    }
    if (!key) {
      res.status(400).send("key required");
      return;
    }
    const body = await this.fake.readObject(key);
    if (!body) {
      res.status(404).send("not found");
      return;
    }
    res
      .set("Cross-Origin-Resource-Policy", "cross-origin")
      .type(this.fake.getContentType(key) ?? "application/octet-stream")
      .send(body);
  }
}
