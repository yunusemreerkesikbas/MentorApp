import { Inject, Injectable } from "@nestjs/common";
import type { VisionDto } from "@mentor/types";
import type { UpsertVisionInput } from "@mentor/validation";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { VisionBoardRepository } from "../infrastructure/vision-board.repository";
import { toVisionDto } from "./coaching.mappers";

/**
 * Vision/goal board ("hayal/hedef panosu") — one text-based goal anchor per user (upsert). Free tier
 * reads the goal; the premium AI motivation note (`aiNote`) is written by W3 via {@link setAiNote},
 * so the `vision_boards` table is only ever mutated inside coaching (workstreams §2).
 */
@Injectable()
export class VisionService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly visions: VisionBoardRepository,
  ) {}

  async getMine(userId: string): Promise<VisionDto | null> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.visions.findByUser(tx, userId);
      return row ? toVisionDto(row) : null;
    });
  }

  async upsert(userId: string, input: UpsertVisionInput): Promise<VisionDto> {
    const normalized = {
      goalTitle: input.goalTitle.trim(),
      targetCity: input.targetCity?.trim() ? input.targetCity.trim() : null,
      motivation: input.motivation?.trim() ? input.motivation.trim() : null,
    };
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.visions.upsert(tx, userId, normalized);
      return toVisionDto(row);
    });
  }

  /** Cache the premium AI motivation note (public surface for W3 — coaching owns the table). */
  async setAiNote(
    userId: string,
    note: string,
    model: string,
    locale: string,
  ): Promise<void> {
    await withUserContext(this.db, { userId }, async (tx) => {
      await this.visions.setAiNote(tx, userId, note, model, locale);
    });
  }

  async getAiNoteLocale(userId: string): Promise<string | null> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.visions.findByUser(tx, userId);
      return row?.aiLocale ?? null;
    });
  }
}
