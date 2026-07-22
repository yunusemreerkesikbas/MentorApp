// Blocks until a TCP port accepts a connection, then exits 0 — so a dependent
// dev server (web/admin) doesn't fire requests at an API that isn't listening yet.
// Port-open is a complete readiness signal here: NestJS calls app.listen() last,
// after seeds/route mapping (apps/api/src/main.ts).
//
// Usage: node scripts/wait-for-port.mjs <port> [host] [timeoutMs]
// On timeout it starts ANYWAY (exit 0) so frontend-only work isn't blocked when
// the API is intentionally down — the web client retries transient failures.
// Default 120s: Nest cold boot on Windows (compile + seeds + route map) often
// exceeds 30s; starting Next early caused ERR_CONNECTION_REFUSED on /auth/*.
import net from "node:net";

const port = Number(process.argv[2]);
const host = process.argv[3] ?? "127.0.0.1";
const timeoutMs = Number(process.argv[4] ?? 120_000);

if (!Number.isInteger(port) || port <= 0) {
  console.error("wait-for-port: missing/invalid port");
  process.exit(1);
}

const deadline = Date.now() + timeoutMs;

function attempt() {
  const socket = net.connect({ port, host });
  let settled = false;
  const finish = (up) => {
    if (settled) return; // connect/error/timeout can race — act once
    settled = true;
    socket.destroy();
    if (up) process.exit(0);
    if (Date.now() >= deadline) {
      console.warn(`wait-for-port: ${host}:${port} not up after ${timeoutMs}ms — starting anyway.`);
      process.exit(0);
    }
    setTimeout(attempt, 300);
  };
  socket.setTimeout(1000); // a stuck (filtered) connect emits 'timeout' instead of hanging forever
  socket.once("connect", () => finish(true));
  socket.once("timeout", () => finish(false));
  socket.once("error", () => finish(false));
}

console.log(`wait-for-port: waiting for ${host}:${port} …`);
attempt();
