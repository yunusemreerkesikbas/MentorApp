import { HttpStatus, Logger } from "@nestjs/common";
import type { ArgumentsHost } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sentry } from "../../observability/sentry";
import { NotFoundError } from "../errors/domain-error";
import { AllExceptionsFilter } from "./all-exceptions.filter";

vi.mock("../../observability/sentry", () => ({ Sentry: { captureException: vi.fn() } }));

const REQUEST_ID = "677c9bcb-5824-4f37-901c-e4ffec7c6213";

function mockHost(requestId = REQUEST_ID) {
  const res = {
    headersSent: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ id: requestId }),
    }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

describe("AllExceptionsFilter", () => {
  const filter = new AllExceptionsFilter();
  afterEach(() => vi.restoreAllMocks());

  it("maps a DomainError to its status/code and includes requestId", () => {
    const { host, res } = mockHost();
    filter.catch(new NotFoundError(), host);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const body = res.json.mock.calls[0]![0] as { code: string; requestId?: string };
    expect(body.code).toBe("NOT_FOUND");
    expect(body.requestId).toBe(REQUEST_ID);
  });

  it("maps an unknown error to 500 INTERNAL_ERROR and never leaks internals", () => {
    const { host, res } = mockHost();
    filter.catch(new Error("secret sql constraint detail"), host);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = res.json.mock.calls[0]![0] as { code: string; details?: unknown };
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.details).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("secret sql constraint detail");
  });

  it("does not send raw error messages, SQL parameters or forged request ids to logs/Sentry", () => {
    const log = vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    const capture = vi.spyOn(Sentry, "captureException").mockReturnValue("event-id");
    const { host, res } = mockHost("forged-secret\nlog");
    const error = Object.assign(new Error("SQL secret-value"), { parameters: ["private-diary"], cause: new Error("provider-token") });
    filter.catch(error, host);
    const emitted = JSON.stringify([log.mock.calls, capture.mock.calls, res.json.mock.calls]);
    for (const value of ["secret-value", "private-diary", "provider-token", "forged-secret"]) expect(emitted).not.toContain(value);
    expect(capture.mock.calls[0]?.[0]).not.toBe(error);
    expect(log.mock.calls[0]?.[0]).toMatchObject({ statusCode: 500, code: "INTERNAL_ERROR" });
  });
});
