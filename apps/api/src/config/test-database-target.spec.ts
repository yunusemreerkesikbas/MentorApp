import { describe, expect, it } from "vitest";
import { assertLocalTestDatabase } from "../../test/database-target";

describe("destructive fixture database target", () => {
  it.each([
    "postgres://fixture:fixture@localhost:5433/mentor_test",
    "postgresql://fixture:fixture@127.0.0.1/mentor_disabled_ai_test",
    "postgres://fixture:fixture@[::1]/mentor_test",
  ])("accepts an explicit local test DB: %s", (url) => {
    expect(() => assertLocalTestDatabase(url)).not.toThrow();
  });

  it.each([
    "not-a-url", "https://localhost/mentor_test", "postgres://localhost/mentor",
    "postgres://remote.example/mentor_test", "postgres://localhost.example/mentor_test",
    "postgres://localhost/mentor_test?host=remote.example",
    "postgres://localhost/mentor_test?hostaddr=192.0.2.1",
    "postgres://localhost/mentor_test?database=production",
  ])("rejects unsafe targets without revealing credentials: %s", (url) => {
    expect(() => assertLocalTestDatabase(url)).toThrow("Fixtures require a loopback _test database without URL query overrides.");
  });
});
