import { Put, Query, Req, Res } from "@nestjs/common";
import { ApiExcludeController, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { Public } from "../../common/auth/public.decorator";
import { Controller } from "@nestjs/common";
import { FakeStorageAdapter } from "../adapters/storage/fake-storage.adapter";
import { PHOTO_MAX_BYTES } from "../../modules/ai/domain/photo-classify.constants";

/**
 * Dev/test fake storage endpoints — only used when STORAGE_PROVIDER=fake.
 */
@ApiExcludeController()
@ApiTags("storage")
@Controller("storage")
export class FakeStorageController {
  constructor(private readonly fake: FakeStorageAdapter) {}

  @Public()
  @Put("fake-upload")
  fakeUpload(
    @Query("key") key: string,
    @Query("contentType") contentType: string,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    if (!key || !contentType) {
      res.status(400).send("key and contentType required");
      return;
    }
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).send("empty body");
      return;
    }
    if (body.length > PHOTO_MAX_BYTES) {
      res.status(413).send("too large");
      return;
    }
    this.fake.putObject(key, body, contentType);
    res.status(200).send("ok");
  }
}
