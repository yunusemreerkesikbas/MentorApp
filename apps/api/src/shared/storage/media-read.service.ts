import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env.validation";
import { DomainError, NotFoundError, UnauthorizedError } from "../../common/errors/domain-error";
import type { RequestUser } from "../../common/auth/current-user";
import { ErrorCode } from "../../common/errors/error-code";
import { TokenService } from "../../modules/identity/application/token.service";
import {
  RAW_STORAGE_PORT,
  type ObjectStoragePort,
} from "../ports/storage.port";
import { StorageBudgetRepository } from "./storage-budget.repository";
import { MediaReadGrantService } from "./media-read-grant.service";
import { isPublicKey } from "./storage-prefixes";
import { validateStorageOperation } from "./storage-budget.validation";
import { uploadPolicy } from "./upload-policy";
import { matchesMediaSession } from "./media-session-proof";

interface MediaMetadata {
  key: string;
  contentType: string;
  size: number;
}

@Injectable()
export class MediaReadService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly grants: MediaReadGrantService,
    private readonly tokens: TokenService,
    private readonly repository: StorageBudgetRepository,
    @Inject(RAW_STORAGE_PORT) private readonly objects: ObjectStoragePort,
  ) {}
  async readPublic(key: string) {
    return this.read(await this.headPublic(key));
  }
  async readPrivate(token: string, proof: unknown) {
    return this.read(await this.headPrivate(token, proof));
  }
  async readAuthenticated(token: string, actor: Pick<RequestUser, "id" | "sessionId">) {
    return this.read(await this.headAuthenticated(token, actor));
  }
  /** JwtAuthGuard has already checked the bearer and the live session. Bind both claims to the grant. */
  async headAuthenticated(token: string, actor: Pick<RequestUser, "id" | "sessionId">): Promise<MediaMetadata> {
    this.assertBounded();
    const grant = this.grants.verify(token);
    if (grant.userId !== actor.id || grant.sessionId !== actor.sessionId) throw new UnauthorizedError();
    return this.metadata(grant.key);
  }
  async headPublic(key: string): Promise<MediaMetadata> {
    this.assertBounded();
    if (!isPublicKey(key)) throw new NotFoundError();
    return this.metadata(key);
  }
  async headPrivate(token: string, proof: unknown): Promise<MediaMetadata> {
    this.assertBounded();
    const grant = this.grants.verify(token);
    if (!matchesMediaSession(proof, grant, this.config.getOrThrow("MEDIA_READ_SECRET", { infer: true }))) {
      throw new UnauthorizedError();
    }
    await this.tokens.validateSession(grant.sessionId, grant.userId);
    return this.metadata(grant.key);
  }
  private assertBounded(): void {
    if (this.config.get("STORAGE_ACCESS_MODE", { infer: true }) !== "bounded")
      throw new NotFoundError();
  }
  private async metadata(key: string): Promise<MediaMetadata> {
    try {
      validateStorageOperation({ kind: "read", key });
    } catch {
      throw new NotFoundError();
    }
    const object = await this.repository.manifest(key);
    if (!object || object.state !== "confirmed") throw unavailable();
    try {
      const policy = uploadPolicy(
        key,
        key.split("/")[1] ?? "",
        object.contentType,
      );
      if (
        !Number.isSafeInteger(object.bytes) ||
        object.bytes <= 0 ||
        object.bytes > policy.maxBytes
      )
        throw unavailable();
    } catch {
      throw unavailable();
    }
    return { key, contentType: object.contentType, size: object.bytes };
  }
  private async read(
    metadata: MediaMetadata,
  ): Promise<{ bytes: Buffer; contentType: string }> {
    try {
      const bytes = await this.objects.readObject(metadata.key, metadata.size);
      if (!Buffer.isBuffer(bytes) || bytes.length !== metadata.size)
        throw unavailable();
      return { bytes, contentType: metadata.contentType };
    } catch {
      throw unavailable();
    }
  }
}

function unavailable() {
  return new DomainError(ErrorCode.STORAGE_TEMPORARILY_UNAVAILABLE, 503);
}
