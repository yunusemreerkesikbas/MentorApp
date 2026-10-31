import {
  All,
  Controller,
  Get,
  Head,
  HttpException,
  Param,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { Public } from "../../common/auth/public.decorator";
import {
  NotFoundError,
  UnauthorizedError,
} from "../../common/errors/domain-error";
import { MediaReadService } from "./media-read.service";

@ApiExcludeController()
@Public()
@Controller("storage/media")
export class MediaController {
  constructor(private readonly media: MediaReadService) {}

  @Head("private")
  async headPrivate(@Query("grant") grant: unknown, @Res() res: Response) {
    privacy(res);
    const metadata = await this.media.headPrivate(privateGrant(grant));
    res.type(metadata.contentType).setHeader("Content-Length", metadata.size);
    res.end();
  }
  @Head("public/*key")
  async headPublic(
    @Param("key") key: string[],
    @Req() req: Request,
    @Res() res: Response,
  ) {
    privacy(res);
    const metadata = await this.media.headPublic(publicKey(key, req));
    res.type(metadata.contentType).setHeader("Content-Length", metadata.size);
    res.end();
  }
  @Get("private")
  async readPrivate(@Query("grant") grant: unknown, @Res() res: Response) {
    privacy(res);
    const result = await this.media.readPrivate(privateGrant(grant));
    res.type(result.contentType).send(result.bytes);
  }
  @Get("public/*key")
  async readPublic(
    @Param("key") key: string[],
    @Req() req: Request,
    @Res() res: Response,
  ) {
    privacy(res);
    const result = await this.media.readPublic(publicKey(key, req));
    res.type(result.contentType).send(result.bytes);
  }
  @All(["private", "public/*key"])
  unsupported(@Res() res: Response): never {
    privacy(res);
    throw new HttpException("Method Not Allowed", 405);
  }
}

function privacy(res: Response): void {
  res.set({
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
}
function privateGrant(value: unknown): string {
  if (typeof value !== "string") throw new UnauthorizedError();
  return value;
}
function publicKey(value: string[], req: Request): string {
  if (
    !Array.isArray(value) ||
    /[%\\]/.test(req.originalUrl.split("?", 1)[0] ?? "")
  )
    throw new NotFoundError();
  return value.join("/");
}
