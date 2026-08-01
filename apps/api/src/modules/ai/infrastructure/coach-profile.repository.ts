import { Inject, Injectable } from "@nestjs/common";
import {
  CoachCalibrationStatus,
  CoachMemoryConsent,
  type CoachProfileDto,
} from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { coachProfiles } from "../../../database/schema";
import type { CoachProfilePatchInput } from "@mentor/validation";
import { eq } from "drizzle-orm";

const DEFAULT_PROFILE: Omit<CoachProfileDto, "updatedAt"> = {
  calibrationStatus: CoachCalibrationStatus.NOT_STARTED,
  memoryConsent: CoachMemoryConsent.PENDING,
  supportPreference: null,
  directnessPreference: null,
};

@Injectable()
export class CoachProfileRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  get(userId: string): Promise<CoachProfileDto> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const [row] = await tx
        .select()
        .from(coachProfiles)
        .where(eq(coachProfiles.userId, userId))
        .limit(1);
      return row
        ? {
            calibrationStatus:
              row.calibrationStatus as CoachProfileDto["calibrationStatus"],
            memoryConsent:
              row.memoryConsent as CoachProfileDto["memoryConsent"],
            supportPreference:
              row.supportPreference as CoachProfileDto["supportPreference"],
            directnessPreference:
              row.directnessPreference as CoachProfileDto["directnessPreference"],
            updatedAt: row.updatedAt.toISOString(),
          }
        : { ...DEFAULT_PROFILE, updatedAt: new Date(0).toISOString() };
    });
  }

  patch(
    userId: string,
    input: CoachProfilePatchInput,
  ): Promise<CoachProfileDto> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const [row] = await tx
        .insert(coachProfiles)
        .values({ userId, ...input, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: coachProfiles.userId,
          set: { ...input, updatedAt: new Date() },
        })
        .returning();
      return {
        calibrationStatus: row!
          .calibrationStatus as CoachProfileDto["calibrationStatus"],
        memoryConsent: row!.memoryConsent as CoachProfileDto["memoryConsent"],
        supportPreference: row!
          .supportPreference as CoachProfileDto["supportPreference"],
        directnessPreference: row!
          .directnessPreference as CoachProfileDto["directnessPreference"],
        updatedAt: row!.updatedAt.toISOString(),
      };
    });
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await withUserContext(this.db, { userId }, async (tx) => {
      await tx.delete(coachProfiles).where(eq(coachProfiles.userId, userId));
    });
  }
}
