import { Injectable } from "@nestjs/common";
import type { AuthUser } from "@mentor/types";
import type { UpdateMeInput } from "@mentor/validation";
import { NotFoundError } from "../../../common/errors/domain-error";
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
  constructor(private readonly usersRepo: UsersRepository) {}

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
