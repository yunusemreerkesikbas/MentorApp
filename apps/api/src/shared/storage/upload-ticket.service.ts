import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { Readable } from "node:stream";
import { ConfigRegistryService } from "../../common/config/config-registry.service";
import { UnauthorizedError } from "../../common/errors/domain-error";
import { RAW_STORAGE_PORT, type ObjectStoragePort, type StorageUploadInput, type StorageUploadUrlResult } from "../ports/storage.port";
import { UploadTicketRepository } from "./upload-ticket.repository";
import { uploadPolicy } from "./upload-policy";
import { readUploadStream } from "./upload-stream";
import { validateUploadContent } from "./upload-content";
import { StorageCleanupService } from "./storage-cleanup.service";

const hash = (ticket: string) => createHash("sha256").update(ticket).digest("hex");

@Injectable()
export class UploadTicketService {
  constructor(
    private readonly tickets: UploadTicketRepository,
    private readonly config: ConfigRegistryService,
    @Inject(RAW_STORAGE_PORT) private readonly objects: ObjectStoragePort,
    private readonly cleanup: StorageCleanupService,
  ) {}

  async issue(input: StorageUploadInput): Promise<StorageUploadUrlResult> {
    const policy = uploadPolicy(input.key, input.ownerId, input.contentType);
    const [activeLimit, dailyBytes, lifetime] = await Promise.all([
      this.config.get("storage.upload.active_per_user"),
      this.config.get("storage.upload.daily_bytes"),
      this.config.get("storage.upload.ticket_seconds"),
    ]);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + lifetime * 1000);
    await this.tickets.issue({ tokenHash: hash(token), key: input.key, ownerId: input.ownerId, sessionId: input.sessionId, orgId: null, contentType: input.contentType, purpose: policy.purpose, maxBytes: policy.maxBytes, expiresAt }, activeLimit, dailyBytes);
    return { url: `/v1/storage/uploads/${token}`, key: input.key, expiresAt: expiresAt.toISOString() };
  }

  async receive(token: string, stream: Readable): Promise<void> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new UnauthorizedError();
    const ticket = await this.tickets.find(hash(token));
    if (!ticket || ticket.status !== "ISSUED" || ticket.expiresAt.getTime() <= Date.now()) throw new UnauthorizedError();
    // No stream listener/body parser runs until the backing session is checked and ticket claimed.
    await this.tickets.assertActiveSession(ticket);
    const dailyBytes = await this.config.get("storage.upload.daily_bytes");
    const claimed = await this.tickets.claim(ticket, dailyBytes);
    let wrote = false;
    try {
      const timeoutSeconds = await this.config.get("storage.upload.stream_seconds");
      const bytes = await readUploadStream(stream, ticket.maxBytes, timeoutSeconds * 1000);
      validateUploadContent(bytes, ticket.contentType);
      await this.tickets.assertActiveSession(ticket);
      // Durable delayed deletion compensates a process crash between object PUT and DB completion.
      await this.cleanup.enqueueFailedUpload(claimed);
      wrote = true;
      await this.objects.putObject(ticket.key, bytes, ticket.contentType);
      await this.tickets.finish(claimed, "COMPLETE", bytes.length);
    } catch (error) {
      await this.tickets.finish(claimed, "FAILED");
      if (wrote) await this.cleanup.deleteObject(ticket.key);
      throw error;
    }
  }
}
