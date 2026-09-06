import { EventEmitter } from "node:events";
import { Writable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import pinoHttp from "pino-http";
import { describe, expect, it } from "vitest";
import { buildLoggerConfig } from "./logger.config";

const REQUEST_ID = "677c9bcb-5824-4f37-901c-e4ffec7c6213";

function logRequest(incomingId: unknown = REQUEST_ID, url = "/v1/auth/register?token=query-secret&code=oauth-secret") {
  let output = "";
  const stream = new Writable({ write(chunk, _encoding, done) { output += String(chunk); done(); } });
  const options = buildLoggerConfig("production").pinoHttp;
  if (!options || Array.isArray(options)) throw new Error("Expected logger options");
  const middleware = pinoHttp(options, stream);
  const req = Object.assign(new EventEmitter(), {
    method: "POST", url,
    headers: { "x-request-id": incomingId, authorization: "Bearer access-secret", cookie: "refresh=refresh-secret", "x-cron-secret": "cron-secret" },
    body: { password: "password-secret", text: "private-diary", card: "card-secret" },
    socket: { remoteAddress: "203.0.113.42", remotePort: 1234 },
  }) as unknown as IncomingMessage;
  const res = Object.assign(new EventEmitter(), {
    statusCode: 500, headersSent: true,
    getHeaders: () => ({ "set-cookie": "new-refresh-secret", location: "https://app.test?token=redirect-secret" }),
    setHeader: () => {},
  }) as unknown as ServerResponse;
  middleware(req, res);
  req.log.error({ err: Object.assign(new Error("SELECT private-diary password-secret"), { code: "23505", parameters: ["db-secret"] }), userId: "user-secret", data: { text: "private-diary" } }, "Provider response: provider-secret");
  req.log.warn("Unhandled payload private-diary");
  res.emit("finish");
  return { output, entries: output.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>) };
}

describe("production logger boundary", () => {
  it("excludes credentials, personal content, headers, bodies, IPs and raw errors from emitted logs", () => {
    const { output, entries } = logRequest();
    for (const value of ["query-secret", "oauth-secret", "access-secret", "refresh-secret", "cron-secret", "password-secret", "private-diary", "card-secret", "203.0.113.42", "redirect-secret", "provider-secret", "db-secret", "user-secret", "SELECT"]) {
      expect(output).not.toContain(value);
    }
    expect(entries.at(-1)).toMatchObject({ req: { id: REQUEST_ID, method: "POST", path: "/v1/auth/register" }, res: { statusCode: 500 }, responseTime: expect.any(Number) });
    expect(entries[0]).toMatchObject({ err: { type: "Error", code: "23505", fingerprint: expect.stringMatching(/^[a-f0-9]{16}$/) } });
  });

  it("redacts upload capabilities carried in URL path segments", () => {
    const { output, entries } = logRequest(REQUEST_ID, "/v1/storage/uploads/opaque-upload-capability-secret?token=another-secret");
    expect(output).not.toContain("opaque-upload-capability-secret");
    expect(output).not.toContain("another-secret");
    expect(entries.at(-1)).toMatchObject({ req: { path: "/v1/storage/uploads/:ticket" } });
  });

  it.each(["injected-secret\nforged log", "a".repeat(10_000), [REQUEST_ID, "secret"], undefined])("replaces invalid or ambiguous request ids", (id) => {
    const { entries, output } = logRequest(id === undefined ? null : id);
    const req = entries.at(-1)?.req as { id: string };
    expect(req.id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);
    expect(output).not.toContain("injected-secret");
    expect(output).not.toContain("a".repeat(100));
  });
});
