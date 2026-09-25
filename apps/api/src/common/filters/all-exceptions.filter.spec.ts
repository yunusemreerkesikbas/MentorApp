import { HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { ArgumentsHost } from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sentry } from "../../observability/sentry";
import { NotFoundError } from "../errors/domain-error";
import { AllExceptionsFilter } from "./all-exceptions.filter";

vi.mock("../../observability/sentry", () => ({ Sentry: { captureException: vi.fn() } }));

const REQUEST_ID = "677c9bcb-5824-4f37-901c-e4ffec7c6213";

function mockHost(requestId = REQUEST_ID, headers: Record<string, string | number | undefined> = {}) {
  const res = {
    headersSent: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    getHeader: (name: string) => headers[name],
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

  it("puts Retry-After seconds into the 429 message", () => {
    mockErrorCatalog({
      "errors.TOO_MANY_REQUESTS_RETRY": "Biraz hızlı gittik. {seconds} saniye sonra tekrar deneyelim.",
    });
    const { host, res } = mockHost(REQUEST_ID, { "Retry-After": 42 });
    filter.catch(new HttpException("throttle", HttpStatus.TOO_MANY_REQUESTS), host);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.TOO_MANY_REQUESTS);
    expect(res.json.mock.calls[0]![0]).toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: "Biraz hızlı gittik. 42 saniye sonra tekrar deneyelim.",
    });
  });

  it("uses the singular retry line when one second remains", () => {
    mockErrorCatalog({
      "errors.TOO_MANY_REQUESTS_RETRY_ONE": "That was a bit fast. Try again in {seconds} second.",
    });
    const { host, res } = mockHost(REQUEST_ID, { "Retry-After": "1" });
    filter.catch(new HttpException("throttle", HttpStatus.TOO_MANY_REQUESTS), host);
    expect(res.json.mock.calls[0]![0]).toMatchObject({
      message: "That was a bit fast. Try again in 1 second.",
    });
  });

  it("keeps the static 429 message when Retry-After is absent", () => {
    mockErrorCatalog({
      "errors.TOO_MANY_REQUESTS": "Biraz hızlı gittik. Kısa bir nefes, sonra tekrar.",
    });
    const { host, res } = mockHost();
    filter.catch(new HttpException("throttle", HttpStatus.TOO_MANY_REQUESTS), host);
    expect(res.json.mock.calls[0]![0]).toMatchObject({
      message: "Biraz hızlı gittik. Kısa bir nefes, sonra tekrar.",
    });
  });
});

function mockErrorCatalog(messages: Record<string, string>) {
  vi.spyOn(I18nContext, "current").mockReturnValue({
    translate: (key: string, options?: { args?: { seconds?: number } }) => {
      const template = messages[key];
      if (!template) return key;
      const seconds = options?.args?.seconds;
      return seconds === undefined ? template : template.replaceAll("{seconds}", String(seconds));
    },
  } as unknown as I18nContext);
}
