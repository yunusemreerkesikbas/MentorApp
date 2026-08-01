import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { CoachProfileService } from "../coach-profile.service";

const payloadSchema = z.object({}).strict().default({});

@Injectable()
export class CleanupCoachMemoryHandler {
  constructor(private readonly profiles: CoachProfileService) {}

  async handle(payload: unknown): Promise<void> {
    payloadSchema.parse(payload ?? {});
    await this.profiles.cleanupExpired();
  }
}
