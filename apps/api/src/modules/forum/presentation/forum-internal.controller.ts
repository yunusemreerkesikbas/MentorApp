import { Controller, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CronSecretGuard } from "../../../common/auth/cron-secret.guard";
import { Public } from "../../../common/auth/public.decorator";
import { ForumThreadService } from "../application/forum-thread.service";

/** Internal cron triggers for forum maintenance (Render Cron → HTTP, shared-secret guarded). */
@ApiTags("internal")
@Public()
@Controller("internal/cron")
@UseGuards(CronSecretGuard)
export class ForumInternalController {
  constructor(private readonly threads: ForumThreadService) {}

  /** Sweep orphaned attachment uploads (minted key, post never created). */
  @Post("cleanup-forum-attachments")
  cleanupAttachments() {
    return this.threads.cleanupOrphanAttachments();
  }
}
