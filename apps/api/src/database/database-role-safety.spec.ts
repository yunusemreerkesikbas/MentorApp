import { describe, expect, it, vi } from "vitest";
import { assertRuntimeDatabaseRole } from "./database-role-safety";

describe("production runtime database role", () => {
  it.each(["superuser", "bypassRls", "ownsTables", "canAssumePrivilegedRole", "canCreateRoles"])("rejects %s privileges", async (flag) => {
    const query = vi.fn().mockResolvedValue({ rows: [{ superuser: false, bypassRls: false, ownsTables: false, canAssumePrivilegedRole: false, canCreateRoles: false, [flag]: true }] });
    await expect(assertRuntimeDatabaseRole({ query }, "production")).rejects.toThrow(/runtime database role/i);
    expect(query).toHaveBeenCalledOnce();
  });

  it("fails closed when the role cannot be inspected", async () => {
    const query = vi.fn().mockRejectedValue(new Error("postgres://secret@host SELECT private"));
    await expect(assertRuntimeDatabaseRole({ query }, "production")).rejects.toThrow("Runtime database role safety check failed.");
  });

  it("accepts only an explicitly unprivileged role result", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ superuser: false, bypassRls: false, ownsTables: false, canAssumePrivilegedRole: false, canCreateRoles: false }] });
    await expect(assertRuntimeDatabaseRole({ query }, "production")).resolves.toBeUndefined();
  });

  it.each([[], [{}]])("rejects missing/malformed results", async (rows) => {
    await expect(assertRuntimeDatabaseRole({ query: vi.fn().mockResolvedValue({ rows }) }, "production")).rejects.toThrow();
  });

  it.each(["development", "test"])("does not query or require a connection in %s", async (env) => {
    const query = vi.fn();
    await assertRuntimeDatabaseRole({ query }, env);
    expect(query).not.toHaveBeenCalled();
  });
});
