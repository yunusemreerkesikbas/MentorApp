import { Injectable } from "@nestjs/common";
import type { AuthUser } from "@mentor/types";
import type { UpdateMeInput } from "@mentor/validation";
import { NotFoundError } from "../../../common/errors/domain-error";
import { UsersRepository } from "../infrastructure/users.repository";
import { toAuthUser } from "./auth.service";

@Injectable()
export class UsersService {
  constructor(private readonly usersRepo: UsersRepository) {}

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
    return toAuthUser(user);
  }

  /** Minimal onboarding profile (display name + exam selection); deep diagnosis is W2. */
  async updateMe(userId: string, patch: UpdateMeInput): Promise<AuthUser> {
    const user = await this.usersRepo.updateSelf(userId, {
      ...(patch.displayName !== undefined && { displayName: patch.displayName }),
      ...(patch.examType !== undefined && { examType: patch.examType }),
      ...(patch.examDate !== undefined && { examDate: patch.examDate }),
    });
    if (!user) throw new NotFoundError();
    return toAuthUser(user);
  }
}
