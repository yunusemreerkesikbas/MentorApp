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
}
