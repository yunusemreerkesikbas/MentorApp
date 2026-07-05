// Blocks until a TCP port accepts a connection, then exits 0 — so a dependent
// dev server (web/admin) doesn't fire requests at an API that isn't listening yet.
// Port-open is a complete readiness signal here: NestJS calls app.listen() last,
// after seeds/route mapping (apps/api/src/main.ts).
//
// Usage: node scripts/wait-for-port.mjs <port> [host] [timeoutMs]
// On timeout it starts ANYWAY (exit 0) so frontend-only work isn't blocked when
// the API is intentionally down — the web client retries transient failures.
import net from "node:net";

const port = Number(process.argv[2]);
const host = process.argv[3] ?? "127.0.0.1";
const timeoutMs = Number(process.argv[4] ?? 30_000);

if (!Number.isInteger(port) || port <= 0) {
  console.error("wait-for-port: missing/invalid port");
  process.exit(1);
}

const deadline = Date.now() + timeoutMs;

function attempt() {
  const socket = net.connect({ port, host });
  socket.once("connect", () => {
    socket.destroy();
    process.exit(0);
  });
  socket.once("error", () => {
    socket.destroy();
    if (Date.now() >= deadline) {
      console.warn(`wait-for-port: ${host}:${port} not up after ${timeoutMs}ms — starting anyway.`);
      process.exit(0);
    }
    setTimeout(attempt, 300);
  });
}

console.log(`wait-for-port: waiting for ${host}:${port} …`);
attempt();
