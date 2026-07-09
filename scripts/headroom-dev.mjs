#!/usr/bin/env node
/**
 * Cross-platform Headroom dev helpers (Mod A — vibe coding).
 * Product koç sidecar: pnpm headroom:up (docker compose).
 *
 * Usage:
 *   node scripts/headroom-dev.mjs install
 *   node scripts/headroom-dev.mjs doctor
 *   node scripts/headroom-dev.mjs wrap <claude|codex|cursor>
 *   node scripts/headroom-dev.mjs unwrap <claude|codex|...>
 */
import { spawnSync } from "node:child_process";
import { platform } from "node:os";

const [, , command, arg] = process.argv;

const WRAP_AGENTS = new Set(["claude", "codex", "cursor", "copilot", "aider", "opencode"]);
const UNWRAP_AGENTS = new Set(["claude", "copilot", "codex", "openclaw", "opencode"]);

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: "inherit", shell: platform() === "win32", ...opts });
  return res.status ?? 1;
}

function whichHeadroom() {
  const probe = platform() === "win32" ? "where" : "which";
  const res = spawnSync(probe, ["headroom"], { encoding: "utf8", shell: platform() === "win32" });
  if (res.status !== 0) return null;
  return res.stdout.trim().split(/\r?\n/)[0] ?? null;
}

function install() {
  console.log("Installing headroom-ai[all] (Python 3.10+ required)...\n");

  if (run("uv", ["tool", "install", "headroom-ai[all]"]) === 0) {
    console.log("\nInstalled via uv. Run: headroom doctor");
    return 0;
  }

  console.log("uv not available or failed — trying pip...\n");
  if (run("python", ["-m", "pip", "install", "headroom-ai[all]"]) === 0) {
    console.log("\nInstalled via pip. Run: headroom doctor");
    return 0;
  }

  if (run("py", ["-m", "pip", "install", "headroom-ai[all]"]) === 0) {
    console.log("\nInstalled via py -m pip. Run: headroom doctor");
    return 0;
  }

  console.error(
    "\nCould not install Headroom. Install manually:\n" +
      "  uv tool install \"headroom-ai[all]\"\n" +
      "  # or: pip install \"headroom-ai[all]\"\n" +
      "Docs: docs/dev/headroom.md",
  );
  return 1;
}

function doctor() {
  const bin = whichHeadroom();
  if (!bin) {
    console.error("headroom CLI not found. Run: pnpm headroom:install\nDocs: docs/dev/headroom.md");
    return 1;
  }
  console.log(`headroom: ${bin}\n`);
  const code = run("headroom", ["doctor"]);
  if (code !== 0) return code;

  console.log("\nOptional — koç API sidecar (Mod B):");
  try {
    const res = spawnSync(
      "curl",
      ["-sf", "http://localhost:8787/health"],
      { encoding: "utf8", shell: platform() === "win32" },
    );
    if (res.status === 0) {
      console.log("  Proxy on :8787 — healthy (docker sidecar or headroom wrap)");
    } else {
      console.log("  No proxy on :8787 (OK for dev-only wrap; use pnpm headroom:up for koç API tests)");
    }
  } catch {
    console.log("  curl not available — skip proxy health check");
  }
  return 0;
}

function wrap(agent) {
  if (!agent || !WRAP_AGENTS.has(agent)) {
    console.error(`Usage: pnpm headroom:wrap <${[...WRAP_AGENTS].join("|")}>`);
    return 1;
  }
  if (!whichHeadroom()) {
    console.error("headroom CLI not found. Run: pnpm headroom:install");
    return 1;
  }
  console.log(`Starting headroom wrap ${agent} — see docs/dev/headroom.md\n`);
  if (agent === "cursor") {
    console.log(
      "Cursor: wrap prints base URLs. Apply them in Cursor Settings (OpenAI/Anthropic override).\n",
    );
  }
  return run("headroom", ["wrap", agent]);
}

function unwrap(agent) {
  if (!agent || !UNWRAP_AGENTS.has(agent)) {
    console.error(`Usage: pnpm headroom:unwrap <${[...UNWRAP_AGENTS].join("|")}>`);
    return 1;
  }
  if (!whichHeadroom()) {
    console.error("headroom CLI not found.");
    return 1;
  }
  return run("headroom", ["unwrap", agent]);
}

switch (command) {
  case "install":
    process.exit(install());
  case "doctor":
    process.exit(doctor());
  case "wrap":
    process.exit(wrap(arg));
  case "unwrap":
    process.exit(unwrap(arg));
  default:
    console.log(`Headroom dev helpers

  pnpm headroom:install          Install Python CLI (uv or pip)
  pnpm headroom:doctor           Verify CLI + optional :8787 proxy
  pnpm headroom:wrap <agent>     Start wrapped session (claude|codex|cursor|…)
  pnpm headroom:unwrap <agent>   Remove durable wrap

  Koç API sidecar: pnpm headroom:up | headroom:down
  Full guide: docs/dev/headroom.md
`);
    process.exit(command ? 1 : 0);
}
