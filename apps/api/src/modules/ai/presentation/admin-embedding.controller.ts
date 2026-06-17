import { Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@mentor/types";
import { Roles } from "../../../common/auth/roles.decorator";
import { EmbeddingService } from "../application/embedding.service";

/**
 * Admin RAG backfill (W3): enqueue embed jobs for published articles still missing an embedding.
 * SUPER_ADMIN only (ops trigger; idempotent — already-embedded articles are skipped by the query).
 */
@ApiTags("ai")
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller("admin/ai")
export class AdminEmbeddingController {
  constructor(private readonly embedding: EmbeddingService) {}

  @Post("reembed")
  reembed(): Promise<{ enqueued: number }> {
    return this.embedding.enqueueBackfill();
  }
}
