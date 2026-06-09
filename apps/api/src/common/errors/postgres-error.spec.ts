import { describe, expect, it } from "vitest";
import { mapPostgresError } from "./postgres-error";

describe("mapPostgresError", () => {
  it("maps unique/fk violation to CONFLICT 409", () => {
    expect(mapPostgresError({ code: "23505" })).toEqual({ code: "CONFLICT", status: 409 });
    expect(mapPostgresError({ code: "23503" })).toEqual({ code: "CONFLICT", status: 409 });
  });

  it("maps not-null / bad-input violations to BAD_REQUEST 400", () => {
    expect(mapPostgresError({ code: "23502" })).toEqual({ code: "BAD_REQUEST", status: 400 });
    expect(mapPostgresError({ code: "22P02" })).toEqual({ code: "BAD_REQUEST", status: 400 });
  });

  it("maps connection-class errors to SERVICE_UNAVAILABLE 503", () => {
    expect(mapPostgresError({ code: "08006" })).toEqual({
      code: "SERVICE_UNAVAILABLE",
      status: 503,
    });
  });

  it("returns null for non-pg / unrecognised errors (→ generic 500)", () => {
    expect(mapPostgresError(new Error("boom"))).toBeNull();
    expect(mapPostgresError({ code: "99999" })).toBeNull();
    expect(mapPostgresError(null)).toBeNull();
  });
});
