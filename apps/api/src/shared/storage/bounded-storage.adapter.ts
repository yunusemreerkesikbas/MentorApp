import { Inject, Injectable } from "@nestjs/common";
import { DomainError } from "../../common/errors/domain-error";
import { ErrorCode } from "../../common/errors/error-code";
import type { ObjectStoragePort } from "../ports/storage.port";
import { STORAGE_BACKEND_PORT } from "./storage-backend.token";
import { StorageBudgetService } from "./storage-budget.service";

@Injectable()
export class BoundedStorageAdapter implements ObjectStoragePort {
  constructor(@Inject(STORAGE_BACKEND_PORT) private readonly backend: ObjectStoragePort, private readonly budget: StorageBudgetService) {}

  putObject(key: string, bytes: Buffer, contentType: string) {
    return this.budget.run({ kind: "put", key, bytes: bytes.length, contentType }, () => this.backend.putObject(key, bytes, contentType));
  }
  readObject(key: string, maxBytes?: number) {
    return this.budget.run({ kind: "read", key, maxBytes }, () => this.backend.readObject(key, maxBytes));
  }
  copyObject(sourceKey: string, key: string) {
    return this.budget.run({ kind: "copy", sourceKey, key }, () => this.backend.copyObject(sourceKey, key));
  }
  listObjects(prefix: string, limit: number) {
    return this.budget.run({ kind: "list", prefix, limit }, () => this.backend.listObjects(prefix, limit));
  }
  deleteObject(key: string) {
    return this.budget.run({ kind: "delete", key }, () => this.backend.deleteObject(key));
  }
  async createReadUrl(_key: string, _expiresInSeconds: number): Promise<string> {
    throw new DomainError(ErrorCode.STORAGE_TEMPORARILY_UNAVAILABLE, 503);
  }
  getPublicUrl(_key: string): string {
    throw new DomainError(ErrorCode.STORAGE_TEMPORARILY_UNAVAILABLE, 503);
  }
}
