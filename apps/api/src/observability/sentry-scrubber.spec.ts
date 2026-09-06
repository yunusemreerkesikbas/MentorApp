import type { Event } from "@sentry/nestjs";
import { describe, expect, it } from "vitest";
import { scrubSentryEvent } from "./sentry-scrubber";

describe("Sentry privacy boundary", () => {
  it("drops request data, breadcrumbs, user context, provider payloads and exception messages", () => {
    const event: Event = {
      event_id: "a".repeat(32), level: "error", environment: "production",
      message: "private-diary", transaction: "/auth?token=secret",
      request: { url: "https://api.test?token=secret", headers: { authorization: "secret" }, data: "secret" },
      user: { email: "secret@example.test", ip_address: "203.0.113.1" },
      extra: { providerResponse: "secret" }, contexts: { custom: { data: "secret" } },
      breadcrumbs: [{ message: "secret", data: { query: "SELECT secret" } }],
      tags: { code: "INTERNAL_ERROR", requestId: "677c9bcb-5824-4f37-901c-e4ffec7c6213", secret: "secret" },
      exception: { values: [{ type: "Error", value: "SELECT secret private-diary", stacktrace: { frames: [{ filename: "/deploy/apps/api/src/modules/identity/auth.service.ts", function: "AuthService.register", lineno: 42, colno: 3, vars: { password: "secret" }, context_line: "secret", pre_context: ["secret"] }] } }] },
    };
    const result = scrubSentryEvent(event);
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("private-diary");
    expect(JSON.stringify(result)).not.toContain("203.0.113.1");
    expect(result).toMatchObject({ event_id: event.event_id, tags: { code: "INTERNAL_ERROR", requestId: event.tags?.requestId }, exception: { values: [{ type: "Error", stacktrace: { frames: [{ filename: "src/modules/identity/auth.service.ts", lineno: 42 }] } }] } });
  });
});
