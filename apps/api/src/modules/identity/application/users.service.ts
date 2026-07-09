import { randomUUID } from "node:crypto";
import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import type { AuthUser, AvatarUploadUrlDto } from "@mentor/types";
import type { AvatarUploadUrlInput, UpdateMeInput } from "@mentor/validation";
import { DomainError, NotFoundError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { isUniqueViolation } from "../../../common/errors/postgres-error";
import { STORAGE_PORT, type StoragePort } from "../../../shared/ports/storage.port";
import {
  AVATAR_ALLOWED_MIME,
  AVATAR_MAX_BYTES,
  extensionForAvatarMime,
  isValidAvatarStorageKey,
} from "../domain/avatar";
import { UsersRepository } from "../infrastructure/users.repository";
import { toAuthUser } from "./auth.service";

/** Admin metrics: user-base snapshot (W6). */
export interface UserStats {
  total: number;
  new7d: number;
  new30d: number;
  verified: number;
  byStatus: { active: number; suspended: number; banned: number };
  byExamType: { kpss: number; yks: number; lgs: number };
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepo: UsersRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  /** Resolve @mention handles → `lowercase-username → userId` map (used by the forum mention notifier). */
  findIdsByUsernames(usernames: string[]): Promise<Map<string, string>> {
    return this.usersRepo.findIdsByUsernames(usernames);
  }

  /** Resolve a single username → full user row (used by the forum profile page). */
  findByUsername(username: string) {
    return this.usersRepo.findByUsernameService(username);
  }

  /** Admin metrics dashboard (W6) — read-only user-base aggregate. */
  async getUserStats(): Promise<UserStats> {
    const s = await this.usersRepo.statsSnapshot();
    return {
      total: s.total,
      new7d: s.new7d,
      new30d: s.new30d,
      verified: s.verified,
      byStatus: { active: s.active, suspended: s.suspended, banned: s.banned },
      byExamType: { kpss: s.kpss, yks: s.yks, lgs: s.lgs },
    };
  }

  /** Minimal contact fields for async notification jobs (W5 — no table access outside identity). */
  async getNotificationContact(
    userId: string,
  ): Promise<{ email: string; displayName: string } | null> {
    const user = await this.usersRepo.findByIdService(userId);
    if (!user) return null;
    return { email: user.email, displayName: user.displayName };
  }

  async getMe(userId: string): Promise<AuthUser> {
    const user = await this.usersRepo.findSelf(userId);
    if (!user) throw new NotFoundError();
    return toAuthUser(user, this.storage);
  }

  async createAvatarUploadUrl(
    userId: string,
    input: AvatarUploadUrlInput,
  ): Promise<AvatarUploadUrlDto> {
    if (!AVATAR_ALLOWED_MIME.has(input.contentType)) {
      throw new DomainError(ErrorCode.AUTH_AVATAR_INVALID_IMAGE, HttpStatus.BAD_REQUEST);
    }

    const ext = extensionForAvatarMime(input.contentType);
    const result = await this.storage.createUploadUrl({
      key: `avatars/${userId}/${randomUUID()}.${ext}`,
      contentType: input.contentType,
    });
    return {
      uploadUrl: result.url,
      key: result.key,
      expiresAt: result.expiresAt,
      maxBytes: AVATAR_MAX_BYTES,
    };
  }

  /** Minimal onboarding profile (display name + exam selection); deep diagnosis is W2. */
  async updateMe(userId: string, patch: UpdateMeInput): Promise<AuthUser> {
    const current =
      patch.avatarStorageKey !== undefined ? await this.usersRepo.findSelf(userId) : undefined;
    if (patch.avatarStorageKey !== undefined && !current) throw new NotFoundError();

    if (typeof patch.avatarStorageKey === "string") {
      await this.assertValidAvatar(userId, patch.avatarStorageKey);
    }

    let user: Awaited<ReturnType<UsersRepository["updateSelf"]>>;
    try {
      user = await this.usersRepo.updateSelf(userId, {
        ...(patch.displayName !== undefined && { displayName: patch.displayName }),
        ...(patch.username !== undefined && { username: patch.username }),
        ...(patch.avatarStorageKey !== undefined && {
          avatarStorageKey: patch.avatarStorageKey,
        }),
        ...(patch.examType !== undefined && { examType: patch.examType }),
        ...(patch.examDate !== undefined && { examDate: patch.examDate }),
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new DomainError(ErrorCode.AUTH_USERNAME_IN_USE, HttpStatus.CONFLICT);
      }
      throw err;
    }
    if (!user) throw new NotFoundError();
    const oldKey = current?.avatarStorageKey;
    if (patch.avatarStorageKey !== undefined && oldKey && oldKey !== user.avatarStorageKey) {
      void this.storage
        .deleteObject(oldKey)
        .catch((err) => this.logger.warn(`avatar cleanup failed for ${oldKey}: ${String(err)}`));
    }
    return toAuthUser(user, this.storage);
  }

  private async assertValidAvatar(userId: string, key: string): Promise<void> {
    if (!isValidAvatarStorageKey(userId, key)) {
      throw new DomainError(ErrorCode.AUTH_AVATAR_INVALID_IMAGE, HttpStatus.BAD_REQUEST);
    }
    const bytes = await this.storage.readObject(key, AVATAR_MAX_BYTES);
    if (!bytes || bytes.length === 0 || bytes.length > AVATAR_MAX_BYTES) {
      throw new DomainError(ErrorCode.AUTH_AVATAR_INVALID_IMAGE, HttpStatus.BAD_REQUEST);
    }
  }
}
