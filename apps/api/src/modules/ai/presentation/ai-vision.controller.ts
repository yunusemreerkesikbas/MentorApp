import { Controller, HttpCode, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { VisionNoteDto } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { VisionNoteService } from "../application/vision-note.service";

/**
 * Premium AI vision/goal-board motivation note (W3). No body — grounds on the user's persisted
 * vision board. Returns the cached note when one already exists (idempotent, §4 #5 premium-only).
 */
@ApiTags("ai")
@ApiBearerAuth()
@Controller("coach")
export class AiVisionController {
  constructor(private readonly visionNote: VisionNoteService) {}

  @Post("vision-note")
  @HttpCode(200)
  note(@CurrentUser() user: RequestUser): Promise<VisionNoteDto> {
    return this.visionNote.note(user);
  }
}
