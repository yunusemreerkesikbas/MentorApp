import { Injectable } from "@nestjs/common";
import { z } from "zod";

const payloadSchema = z.object({ userId: z.string().uuid() });

/** Keeps the legacy job registered while safely draining already queued payloads. */
@Injectable()
export class RefreshMemoryHandler {
  async handle(payload: unknown): Promise<void> {
    payloadSchema.parse(payload);
  }
}
