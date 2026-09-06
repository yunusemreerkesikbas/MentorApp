import { Controller, HttpCode, Put, Req } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Request } from "express";
import { Public } from "../../common/auth/public.decorator";
import { UploadTicketService } from "./upload-ticket.service";

/** Opaque, single-use upload capability. The service authenticates its bound session before reading. */
@ApiExcludeController()
@Controller("storage/uploads")
export class UploadTicketController {
  constructor(private readonly uploads: UploadTicketService) {}

  @Public()
  @Put(":ticket")
  @HttpCode(204)
  receive(@Req() req: Request & { params: { ticket: string } }): Promise<void> {
    return this.uploads.receive(req.params.ticket, req);
  }
}
