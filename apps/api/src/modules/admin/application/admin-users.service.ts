import { HttpStatus, Injectable } from "@nestjs/common";
import { UserRole } from "@mentor/types";
import { ErrorCode } from "../../../common/errors/error-code";
import { DomainError } from "../../../common/errors/domain-error";
import { AdminUsersRepository, type AdminUserRow } from "../infrastructure/admin-users.repository";

/** User row as shown in the admin panel (no secrets — never expose passwordHash). */
export interface AdminUserView {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  status: string;
  isStaff: boolean;
  createdAt: string;
}

/** Result of a role mutation — carries before/after for the audit trail. */
export interface RoleChangeResult {
  user: AdminUserView;
  before: string[];
  after: string[];
}

/** Fuller view for the user detail screen (still secret-free). */
export interface AdminUserDetail extends AdminUserView {
  organizationId: string | null;
  examType: string | null;
  examDate: string | null;
  emailVerified: boolean;
  updatedAt: string;
}

/** Generic before/after change result (status / anonymize) for the audit trail. */
export interface FieldChangeResult<T> {
  user: AdminUserView;
  before: T;
  after: T;
}

function toView(row: AdminUserRow): AdminUserView {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    roles: row.roles,
    status: row.status,
    isStaff: row.roles.includes(UserRole.STAFF),
    createdAt: row.createdAt.toISOString(),
  };
}

function toDetail(row: AdminUserRow): AdminUserDetail {
  return {
    ...toView(row),
    organizationId: row.organizationId,
    examType: row.examType,
    examDate: row.examDate,
    emailVerified: row.emailVerifiedAt !== null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly repo: AdminUsersRepository) {}

  async search(q: string | undefined, page: number, pageSize: number): Promise<AdminUserView[]> {
    const rows = await this.repo.search(q, page, pageSize);
    return rows.map(toView);
  }

  /**
   * Grant the STAFF role (idempotent). STAFF = always-premium entitlement without a
   * subscription row (devnote 0015) — sensitive, hence audited by the caller's interceptor.
   */
  async grantStaff(userId: string): Promise<RoleChangeResult> {
    return this.mutateRoles(userId, (roles) =>
      roles.includes(UserRole.STAFF) ? roles : [...roles, UserRole.STAFF],
    );
  }

  /** Revoke the STAFF role (idempotent). */
  async revokeStaff(userId: string): Promise<RoleChangeResult> {
    return this.mutateRoles(userId, (roles) => roles.filter((r) => r !== UserRole.STAFF));
  }

  private async mutateRoles(
    userId: string,
    compute: (roles: string[]) => string[],
  ): Promise<RoleChangeResult> {
    const change = await this.repo.setRoles(userId, compute);
    if (!change) {
      throw new DomainError(ErrorCode.ADMIN_USER_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    const row = await this.repo.findById(userId);
    return { user: toView(row!), before: change.before, after: change.after };
  }

  /** Full (secret-free) detail for the user screen. */
  async getDetail(userId: string): Promise<AdminUserDetail> {
    const row = await this.repo.findById(userId);
    if (!row) throw new DomainError(ErrorCode.ADMIN_USER_NOT_FOUND, HttpStatus.NOT_FOUND);
    return toDetail(row);
  }

  /** Graduated status change (§9). Admins cannot change their own status (self-lockout guard). */
  async setStatus(
    actorId: string,
    userId: string,
    status: string,
  ): Promise<FieldChangeResult<string>> {
    this.assertNotSelf(actorId, userId);
    const change = await this.repo.updateStatus(userId, status);
    if (!change) throw new DomainError(ErrorCode.ADMIN_USER_NOT_FOUND, HttpStatus.NOT_FOUND);
    const row = await this.repo.findById(userId);
    return { user: toView(row!), before: change.before, after: change.after };
  }

  /** KVKK data export — the user's own identity data (no secrets). Cross-module data: later slice. */
  async exportData(userId: string): Promise<Record<string, unknown>> {
    const row = await this.repo.findById(userId);
    if (!row) throw new DomainError(ErrorCode.ADMIN_USER_NOT_FOUND, HttpStatus.NOT_FOUND);
    const { passwordHash: _omit, ...rest } = row;
    return {
      ...rest,
      kvkkAcceptedAt: row.kvkkAcceptedAt?.toISOString() ?? null,
      emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** KVKK erasure by anonymization (soft). Admins cannot anonymize themselves. */
  async anonymize(
    actorId: string,
    userId: string,
  ): Promise<FieldChangeResult<Record<string, unknown>>> {
    this.assertNotSelf(actorId, userId);
    const change = await this.repo.anonymize(userId);
    if (!change) throw new DomainError(ErrorCode.ADMIN_USER_NOT_FOUND, HttpStatus.NOT_FOUND);
    const row = await this.repo.findById(userId);
    return { user: toView(row!), before: change.before, after: change.after };
  }

  private assertNotSelf(actorId: string, userId: string): void {
    if (actorId === userId) {
      throw new DomainError(ErrorCode.ADMIN_CANNOT_MODIFY_SELF, HttpStatus.FORBIDDEN);
    }
  }
}
