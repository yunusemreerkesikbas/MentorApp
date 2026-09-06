import { Controller, Get, Query, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { Env } from "../../config/env.validation";
import { Public } from "../../common/auth/public.decorator";
import { FakeStorageAdapter } from "../adapters/storage/fake-storage.adapter";
import { isPublicKey } from "./storage-prefixes";

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
  @Get("fake-object")
  async fakeObject(@Query("key") key: string, @Res() res: Response): Promise<void> {
    if (!this.enabled()) {
      res.status(404).send("not found");
      return;
    }
    if (!key || !isPublicKey(key)) {
      res.status(key ? 404 : 400).send(key ? "not found" : "key required");
      return;
    }
    const body = await this.fake.readObject(key);
    if (!body) {
      res.status(404).send("not found");
      return;
    }
    const contentType = this.fake.getContentType(key) ?? "application/octet-stream";
    if (isDownload(contentType)) res.attachment(key.split("/").at(-1));
    res
      .set("Cross-Origin-Resource-Policy", "cross-origin")
      .type(contentType)
      .send(body);
  }

  @Public()
  @Get("fake-private-object")
  async fakePrivateObject(
    @Query("key") key: string,
    @Query("expires") expiresRaw: string,
    @Query("signature") signature: string,
    @Res() res: Response,
  ): Promise<void> {
    const expires = Number(expiresRaw);
    if (!this.enabled() || !this.fake.verifyReadSignature(key, expires, signature)) {
      res.status(404).send("not found"); return;
    }
    const body = await this.fake.readObject(key);
    if (!body) { res.status(404).send("not found"); return; }
    const contentType = this.fake.getContentType(key) ?? "application/octet-stream";
    if (isDownload(contentType)) res.attachment(key.split("/").at(-1));
    res
      .set("Cache-Control", "private, no-store")
      .set("Cross-Origin-Resource-Policy", "cross-origin")
      .type(contentType)
      .send(body);
  }
}

function isDownload(contentType: string): boolean {
  return contentType === "application/pdf" || contentType.startsWith("application/vnd.openxmlformats-officedocument.");
}
