import { JwtService } from "@nestjs/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "../../../common/errors/domain-error";
import { hashToken, TokenService } from "./token.service";

/** In-memory fake of RefreshTokenRepository (rotation semantics included). */
function makeRefreshRepoFake() {
  type Row = {
    id: string;
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
    revokedAt: Date | null;
  };
  const rows: Row[] = [];
  let seq = 0;
  return {
    rows,
    create: vi.fn(async (input: Omit<Row, "id" | "revokedAt">) => {
      const row: Row = { id: `r${++seq}`, revokedAt: null, ...input };
      rows.push(row);
      return row;
    }),
    findByHash: vi.fn(async (hash: string) => rows.find((r) => r.tokenHash === hash)),
    revokeById: vi.fn(async (id: string) => {
      const row = rows.find((r) => r.id === id && !r.revokedAt);
      if (row) row.revokedAt = new Date();
      return row;
    }),
    revokeFamily: vi.fn(async (familyId: string) => {
      rows.filter((r) => r.familyId === familyId && !r.revokedAt).forEach((r) => {
        r.revokedAt = new Date();
      });
    }),
    revokeAllForUser: vi.fn(async (userId: string) => {
      rows.filter((r) => r.userId === userId && !r.revokedAt).forEach((r) => {
        r.revokedAt = new Date();
      });
    }),
  };
}

const USER = { id: "u1", roles: ["STUDENT"], organizationId: null };

describe("TokenService", () => {
  let service: TokenService;
  let repo: ReturnType<typeof makeRefreshRepoFake>;

  beforeEach(() => {
    repo = makeRefreshRepoFake();
    const jwt = new JwtService({ secret: "test-secret-test-secret-test-secret" });
    const config = {
      get: vi.fn((key: string) => (key === "JWT_ACCESS_TTL" ? 900 : 2_592_000)),
    };
    const usersRepo = {
      findByIdService: vi.fn(async () => ({
        id: USER.id,
        roles: USER.roles,
        organizationId: null,
        status: "ACTIVE",
      })),
    };
    service = new TokenService(
      jwt,
      config as never,
      repo as never,
      usersRepo as never,
    );
  });

  it("issue() stores only the hash, never the raw refresh token", async () => {
    const tokens = await service.issue(USER);
    expect(tokens.refreshToken.length).toBeGreaterThan(30);
    expect(repo.rows[0]!.tokenHash).toBe(hashToken(tokens.refreshToken));
    expect(repo.rows[0]!.tokenHash).not.toBe(tokens.refreshToken);
  });

  it("rotate() revokes the old token and issues a new one in the same family", async () => {
    const first = await service.issue(USER);
    const { tokens: second } = await service.rotate(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(repo.rows[0]!.revokedAt).not.toBeNull(); // old revoked
    expect(repo.rows[1]!.familyId).toBe(repo.rows[0]!.familyId); // same family
  });

  it("reusing a rotated token revokes the WHOLE family (theft assumption)", async () => {
    const first = await service.issue(USER);
    await service.rotate(first.refreshToken); // legitimate rotation
    await expect(service.rotate(first.refreshToken)).rejects.toBeInstanceOf(DomainError); // replay
    expect(repo.rows.every((r) => r.revokedAt !== null)).toBe(true); // descendants dead too
  });

  it("an expired refresh token is rejected and its family revoked", async () => {
    const tokens = await service.issue(USER);
    repo.rows[0]!.expiresAt = new Date(Date.now() - 1000);
    await expect(service.rotate(tokens.refreshToken)).rejects.toBeInstanceOf(DomainError);
    expect(repo.revokeFamily).toHaveBeenCalled();
  });

  it("an unknown refresh token is rejected", async () => {
    await expect(service.rotate("does-not-exist")).rejects.toBeInstanceOf(DomainError);
  });
});
