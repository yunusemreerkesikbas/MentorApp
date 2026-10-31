/** Global fixture cleanup must reject unsafe targets before opening any connection. */
export function assertLocalTestDatabase(url: string): void {
  const message = "Fixtures require a loopback _test database without URL query overrides.";
  let target: URL;
  try { target = new URL(url); } catch { throw new Error(message); }
  if (!["postgres:", "postgresql:"].includes(target.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname.toLowerCase()) ||
    !/^\/[a-zA-Z0-9_]+_test$/.test(target.pathname) || target.search) {
    throw new Error(message);
  }
}
