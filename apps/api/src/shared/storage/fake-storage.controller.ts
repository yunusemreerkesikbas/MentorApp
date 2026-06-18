import { Controller, Get, Put, Query, Req, Res } from "@nestjs/common";
import { ApiExcludeController, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { Public } from "../../common/auth/public.decorator";
import { FakeStorageAdapter } from "../adapters/storage/fake-storage.adapter";
import { PHOTO_MAX_BYTES } from "../../modules/ai/domain/photo-classify.constants";

/**
 * Dev/test fake storage endpoints — only used when STORAGE_PROVIDER=fake.
 * Clients PUT bytes to the signed URL returned by createUploadUrl.
 */
@ApiExcludeController()
@ApiTags("storage")
@Controller("storage")
export class FakeStorageController {
  constructor(private readonly fake: FakeStorageAdapter) {}

  @Public()
  @Put("fake-upload")
  async fakeUpload(
    @Query("key") key: string,
    @Query("contentType") contentType: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!key || !contentType) {
      res.status(400).send("key and contentType required");
      return;
    }
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of req) {
      const buf = Buffer.from(chunk);
      total += buf.length;
      if (total > PHOTO_MAX_BYTES) {
        res.status(413).send("too large");
        return;
      }
      chunks.push(buf);
    }
    const bytes = Buffer.concat(chunks);
    this.fake.putObject(key, bytes, contentType);
    res.status(200).send("ok");
  }

  @Public()
  @Get("fake-object")
  async fakeGet(@Query("key") key: string, @Res() res: Response): Promise<void> {
    if (!key) {
      res.status(400).send("key required");
      return;
    }
    const bytes = await this.fake.readObject(key);
    if (!bytes) {
      res.status(404).send("not found");
      return;
    }
    const ct = this.fake.getContentType(key) ?? "application/octet-stream";
    res.setHeader("Content-Type", ct);
    res.status(200).send(bytes);
  }
}
