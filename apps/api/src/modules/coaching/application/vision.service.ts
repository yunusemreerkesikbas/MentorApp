import { Inject, Injectable } from "@nestjs/common";
import type { VisionDto } from "@mentor/types";
import type { UpsertVisionInput } from "@mentor/validation";
import { ValidationFailedError } from "../../../common/errors/domain-error";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { GeoService } from "../../content/application/geo.service";
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
    private readonly geo: GeoService,
  ) {}

  async getMine(userId: string): Promise<VisionDto | null> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const row = await this.visions.findByUser(tx, userId);
      return row ? toVisionDto(row) : null;
    });
  }

  /**
   * The goal with its reference ids turned into names — what a prompt needs to name the target
   * instead of quoting a uuid.
   *
   * City follows the board's read rule: the map selection wins, and the legacy free-text field is
   * the fallback for goals written before the map existed (or ones the province list cannot
   * express). Missing that fallback is exactly how the AI note lost the city: the new UI only ever
   * writes `targetCityCode`, so anything reading `targetCity` alone now sees null.
   *
   * Called only on a cache miss — resolving names on every cached read would be two queries spent
   * on a string nobody looks at.
   */
  async resolveTargetNames(
    board: VisionDto,
  ): Promise<{ cityName: string | null; universityName: string | null }> {
    const { cityName, universityName } = await this.geo.resolveNames(
      board.targetCityCode,
      board.targetUniversityId,
    );
    return { cityName: cityName ?? board.targetCity, universityName };
  }

  async upsert(userId: string, input: UpsertVisionInput): Promise<VisionDto> {
    const targetCityCode = input.targetCityCode ?? null;
    const targetUniversityId = input.targetUniversityId ?? null;

    // The schema already rejects a university without a city. What it cannot know is whether the
    // university actually sits in that city — the client picks both from the map, but a crafted
    // request could pair any university with any province, and the map would then draw the goal
    // in the wrong place forever.
    if (targetUniversityId && targetCityCode) {
      const belongs = await this.geo.universityExistsInCity(
        targetUniversityId,
        targetCityCode,
      );
      if (!belongs) {
        throw new ValidationFailedError({ reason: "university_city_mismatch" });
      }
    }

    const normalized = {
      goalTitle: input.goalTitle.trim(),
      targetCityCode,
      targetCity: input.targetCity?.trim() ? input.targetCity.trim() : null,
      targetUniversityId,
      careerGroup: input.careerGroup ?? null,
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
