import { Inject, Injectable } from "@nestjs/common";
import { ForbiddenError } from "../../common/errors/domain-error";
import { RAW_STORAGE_PORT, type ObjectStoragePort, type StoragePort, type StorageUploadInput } from "../ports/storage.port";
import { isPrivateKey } from "./storage-prefixes";
import { UploadTicketService } from "./upload-ticket.service";
import { StorageCleanupService } from "./storage-cleanup.service";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env.validation";
import type { StorageReadActor } from "./storage-budget.types";
import { MediaReadGrantService } from "./media-read-grant.service";
import { ConfigRegistryService } from "../../common/config/config-registry.service";

@Injectable()
export class SecureStorageService implements StoragePort {
  constructor(
    @Inject(RAW_STORAGE_PORT) private readonly objects: ObjectStoragePort,
    private readonly uploads: UploadTicketService,
    private readonly cleanup: StorageCleanupService,
    private readonly config: ConfigService<Env,true>,
    private readonly grants: MediaReadGrantService,
    private readonly registry: ConfigRegistryService,
  ) {}
  createUploadUrl(input: StorageUploadInput) { return this.uploads.issue(input); }
  async getPrivateUrl(key: string, actor: StorageReadActor): Promise<string> {
    if (!isPrivateKey(key) || key.split("/")[1] !== actor.userId || key.split("/").length !== 3) throw new ForbiddenError();
    if (this.config.get("STORAGE_ACCESS_MODE",{infer:true}) === "bounded") {
      return this.grants.privateUrl(this.grants.issue(key,actor,await this.registry.get("storage.media.read_seconds")));
    }
    return this.objects.createReadUrl(key, 300);
  }
  getPublicUrl(key: string) {
    return this.config.get("STORAGE_ACCESS_MODE",{infer:true}) === "bounded" ? this.grants.publicUrl(key) : this.objects.getPublicUrl(key);
  }
  readObject(key: string, maxBytes?: number) { return this.objects.readObject(key, maxBytes); }
  deleteObject(key: string) { return this.cleanup.deleteObject(key); }
  copyObject(source: string, destination: string) { return this.objects.copyObject(source, destination); }
  listObjects(prefix: string, limit: number) { return this.objects.listObjects(prefix, limit); }
}
