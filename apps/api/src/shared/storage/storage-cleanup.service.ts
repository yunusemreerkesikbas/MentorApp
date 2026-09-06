import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { z } from "zod";
import { JobRunnerService } from "../../modules/notifications/application/job-runner.service";
import { JOB_QUEUE_PORT, type JobQueuePort } from "../ports/job-queue.port";
import { RAW_STORAGE_PORT, type ObjectStoragePort } from "../ports/storage.port";
import { UploadTicketRepository, type UploadTicket } from "./upload-ticket.repository";

@Injectable()
export class StorageCleanupService implements OnModuleInit {
  constructor(
    @Inject(JOB_QUEUE_PORT) private readonly jobs: JobQueuePort,
    @Inject(RAW_STORAGE_PORT) private readonly objects: ObjectStoragePort,
    private readonly runner: JobRunnerService,
    private readonly tickets: UploadTicketRepository,
  ) {}

  onModuleInit() {
    this.runner.registerHandler("storage.delete-object", async (payload) => {
      const { key } = z.object({ key: z.string().min(1) }).parse(payload);
      await this.objects.deleteObject(key);
    });
    this.runner.registerHandler("storage.cleanup-failed-upload", async (payload) => {
      const { tokenHash, key } = z.object({ tokenHash: z.string(), key: z.string() }).parse(payload);
      const ticket = await this.tickets.find(tokenHash);
      if (ticket?.status !== "COMPLETE") await this.objects.deleteObject(key);
    });
  }

  async deleteObject(key: string): Promise<void> {
    // Persist first: feature rows may already be deleted and cannot be the retry source.
    await this.jobs.enqueue("storage.delete-object", { key });
  }

  async enqueueFailedUpload(ticket: UploadTicket): Promise<void> {
    await this.jobs.enqueue("storage.cleanup-failed-upload", { tokenHash: ticket.tokenHash, key: ticket.key }, { runAt: new Date(ticket.expiresAt.getTime() + 60_000) });
  }
}
