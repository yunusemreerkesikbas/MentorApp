import { JwtService } from "@nestjs/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "../../../common/errors/domain-error";
import { hashToken, TokenService } from "./token.service";

const USER = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", sessionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", roles: ["STUDENT"], orgId: null };

describe("TokenService", () => {
  let service: TokenService;
  let sessions: Record<string, ReturnType<typeof vi.fn>>;
  beforeEach(() => {
    sessions = {
      create: vi.fn(async (_uid, sid) => ({ ...USER, sessionId: sid })),
      rotate: vi.fn(async () => USER), findActive: vi.fn(async () => USER),
      revokeByTokenHash: vi.fn(), revokeAllForUser: vi.fn(), resetPassword: vi.fn(async () => "ok"),
    };
    service = new TokenService(
      new JwtService({ secret: "test-secret-test-secret-test-secret" }),
      { get: vi.fn((key: string) => key === "JWT_ACCESS_TTL" ? 900 : 2_592_000) } as never,
      sessions as never,
    );
  });

  it("stores only the refresh hash and signs the persistent sid", async () => {
    const tokens = await service.issue({ id: USER.id, roles: USER.roles, organizationId: null });
    const record = sessions.create.mock.calls[0]![2];
    expect(record.tokenHash).toBe(hashToken(tokens.refreshToken));
    expect(record.tokenHash).not.toBe(tokens.refreshToken);
    expect(new JwtService({ secret: "test-secret-test-secret-test-secret" }).verify(tokens.accessToken)).toMatchObject({ sub: USER.id, sid: expect.any(String) });
  });

  it("passes a password snapshot into atomic session creation", async () => {
    await service.issue({ id: USER.id, roles: USER.roles, organizationId: null }, "old-hash");
    expect(sessions.create).toHaveBeenCalledWith(USER.id, expect.any(String), expect.any(Object), "old-hash");
  });

  it("rotates atomically through the repository", async () => {
    const result = await service.rotate("old-token");
    expect(sessions.rotate).toHaveBeenCalledWith(hashToken("old-token"), expect.objectContaining({ tokenHash: expect.any(String) }));
    expect(result.userId).toBe(USER.id);
  });

  it("rejects replay, expiry, and revocation reported by the transaction", async () => {
    sessions.rotate.mockResolvedValue(null);
    await expect(service.rotate("dead-token")).rejects.toBeInstanceOf(DomainError);
  });

  it("returns fresh principal data only from an active session", async () => {
    await expect(service.validateSession(USER.sessionId, USER.id)).resolves.toEqual(USER);
    sessions.findActive.mockResolvedValue(null);
    await expect(service.validateSession(USER.sessionId, USER.id)).rejects.toBeInstanceOf(DomainError);
  });
});
