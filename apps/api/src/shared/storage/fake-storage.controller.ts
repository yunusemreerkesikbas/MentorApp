import { Controller, Get, Put, Query, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import type { Env } from "../../config/env.validation";
import { Public } from "../../common/auth/public.decorator";
import { FakeStorageAdapter } from "../adapters/storage/fake-storage.adapter";
import { PHOTO_ALLOWED_MIME, PHOTO_MAX_BYTES } from "../../modules/ai/domain/photo-classify.constants";
import { AVATAR_MAX_BYTES } from "../../modules/identity/domain/avatar";

function maxBytesForKey(key: string): number {
  return key.startsWith("avatars/") ? AVATAR_MAX_BYTES : PHOTO_MAX_BYTES;
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
    if (!PHOTO_ALLOWED_MIME.has(contentType)) {
      res.status(400).send("unsupported contentType");
      return undefined;
    }
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).send("empty body");
      return undefined;
    }
    if (body.length > maxBytesForKey(key)) {
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
