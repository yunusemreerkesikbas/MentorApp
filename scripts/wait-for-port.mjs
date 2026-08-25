// Wait until the API port accepts TCP, then exit 0.
// Web/admin `dev` scripts use this so Next does not start before Nest listen().
import net from "node:net";

const port = Number(process.argv[2]);
const host = process.argv[3] ?? "127.0.0.1";

if (!Number.isInteger(port) || port <= 0) {
  console.error("wait-for-port: missing/invalid port");
  process.exit(1);
}

const startedAt = Date.now();
let lastLogAt = 0;

function attempt() {
  const socket = net.connect({ port, host });
  let settled = false;
  const finish = (up) => {
    if (settled) return;
    settled = true;
    socket.destroy();
    if (up) {
      console.log(`wait-for-port: ${host}:${port} is up`);
      process.exit(0);
    }
    const elapsed = Date.now() - startedAt;
    if (elapsed - lastLogAt >= 10_000) {
      lastLogAt = elapsed;
      console.log(`wait-for-port: still waiting for ${host}:${port} (${Math.round(elapsed / 1000)}s)`);
    }
    setTimeout(attempt, 300);
  };
  socket.setTimeout(1000);
  socket.once("connect", () => finish(true));
  socket.once("timeout", () => finish(false));
  socket.once("error", () => finish(false));
}

console.log(`wait-for-port: waiting for ${host}:${port} …`);
attempt();
