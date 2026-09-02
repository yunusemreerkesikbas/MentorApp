import { HttpStatus, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { MentorshipInviteCodeDto } from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import {
  MENTORSHIP_INVITE_CODE_BYTES,
  MENTORSHIP_INVITE_CODE_PREFIX,
} from "../domain/mentorship.constants";
import {
  MentorshipInviteCodeRepository,
  type MentorshipInviteCodeRow,
} from "../infrastructure/mentorship-invite-code.repository";

const generateCode = (): string =>
  `${MENTORSHIP_INVITE_CODE_PREFIX}${randomBytes(MENTORSHIP_INVITE_CODE_BYTES)
    .toString("hex")
    .toUpperCase()}`;

const toDto = (row: MentorshipInviteCodeRow): MentorshipInviteCodeDto => ({
  code: row.code,
  expiresAt: row.expiresAt.toISOString(),
});

/**
 * The coach's invite code (§9 BYOS): the coach's half of the double opt-in. Issuing a code IS the
 * coach's consent; the student's redemption is theirs. There is no separate coach-approval step.
 *
 * No use counter — the abuse bound is the coach's active-student quota, enforced on redemption.
 */
@Injectable()
export class MentorshipInviteService {
  constructor(
    private readonly repo: MentorshipInviteCodeRepository,
    private readonly config: ConfigRegistryService,
  ) {}

  /** The coach's current code, or null if they never issued one / let it lapse silently. */
  async getCurrent(coachId: string): Promise<MentorshipInviteCodeDto | null> {
    const row = await this.repo.findByCoach(coachId);
    return row ? toDto(row) : null;
  }

  /** Issue (or rotate) the code. The previous code stops working immediately. */
  async rotate(coachId: string): Promise<MentorshipInviteCodeDto> {
    const ttlDays = await this.config.get("mentorship.invite_code.ttl_days");
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      if (await this.repo.findByCode(code)) continue;
      return toDto(await this.repo.upsert(coachId, code, expiresAt));
    }
    // 48 bits of entropy: five straight collisions means something is wrong, not unlucky.
    throw new DomainError(ErrorCode.INTERNAL_ERROR, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  /**
   * Resolve a redeemable code to its coach. Both "no such code" and "expired" are distinct so the
   * student is told to ask for a fresh one instead of doubting what they typed.
   */
  async resolveCoachId(code: string): Promise<string> {
    const row = await this.repo.findByCode(code);
    if (!row) throw new DomainError(ErrorCode.MENTORSHIP_INVITE_INVALID, HttpStatus.NOT_FOUND);
    if (row.expiresAt.getTime() <= Date.now()) {
      throw new DomainError(ErrorCode.MENTORSHIP_INVITE_EXPIRED, HttpStatus.GONE);
    }
    return row.coachId;
  }
}
