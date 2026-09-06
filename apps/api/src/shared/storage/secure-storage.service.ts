import { Inject, Injectable } from "@nestjs/common";
import { ForbiddenError } from "../../common/errors/domain-error";
import { RAW_STORAGE_PORT, type ObjectStoragePort, type StoragePort, type StorageUploadInput } from "../ports/storage.port";
import { isPrivateKey } from "./storage-prefixes";
import { UploadTicketService } from "./upload-ticket.service";
import { StorageCleanupService } from "./storage-cleanup.service";

@Injectable()
export class SecureStorageService implements StoragePort {
  constructor(
    @Inject(RAW_STORAGE_PORT) private readonly objects: ObjectStoragePort,
    private readonly uploads: UploadTicketService,
    private readonly cleanup: StorageCleanupService,
  ) {}
  createUploadUrl(input: StorageUploadInput) { return this.uploads.issue(input); }
  async getPrivateUrl(key: string, ownerId: string): Promise<string> {
    if (!isPrivateKey(key) || key.split("/")[1] !== ownerId || key.split("/").length !== 3) throw new ForbiddenError();
    return this.objects.createReadUrl(key, 300);
  }
  getPublicUrl(key: string) { return this.objects.getPublicUrl(key); }
  readObject(key: string, maxBytes?: number) { return this.objects.readObject(key, maxBytes); }
  deleteObject(key: string) { return this.cleanup.deleteObject(key); }
  copyObject(source: string, destination: string) { return this.objects.copyObject(source, destination); }
  listObjects(prefix: string, limit: number) { return this.objects.listObjects(prefix, limit); }
}
