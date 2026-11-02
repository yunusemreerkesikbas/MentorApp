import { HttpStatus } from "@nestjs/common";
import type { CoachPlanAdaptationInput } from "@mentor/validation";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import type { MoodService } from "../../coaching/application/mood.service";
import type { SessionService } from "../../coaching/application/session.service";
import type { CoachProfileService } from "./coach-profile.service";

/** Coaching preferences always; structured memory only after explicit consent. */
export async function planPersonalContext(
  profiles: CoachProfileService,
  userId: string,
) {
  const profile = await profiles.getProfile(userId);
  const memories =
    profile.memoryConsent === "GRANTED"
      ? await profiles.getPromptMemories(userId)
      : [];
  return {
    memories,
    preferences: {
      support: profile.supportPreference,
      directness: profile.directnessPreference,
    },
  };
}

export async function assertPlanSourceApplicable(
  moods: MoodService,
  sessions: SessionService,
  userId: string,
  input: CoachPlanAdaptationInput,
  now = new Date(),
): Promise<void> {
  if (input.source === "MOOD") {
    const mood = await moods.getToday(userId, now);
    if (!mood || mood.mood > 2) {
      throw new DomainError(
        ErrorCode.AI_PLAN_ADAPTATION_NOT_APPLICABLE,
        HttpStatus.CONFLICT,
      );
    }
    return;
  }
  if (input.source === "SESSION") {
    const session = await sessions.getById(userId, input.sessionId);
    if (!session) {
      throw new DomainError(
        ErrorCode.COACHING_SESSION_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }
    if (session.status !== "COMPLETED" || session.sessionMood !== 1) {
      throw new DomainError(
        ErrorCode.AI_PLAN_ADAPTATION_NOT_APPLICABLE,
        HttpStatus.CONFLICT,
      );
    }
  }
}
