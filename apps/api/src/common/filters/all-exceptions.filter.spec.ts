import { HttpStatus } from "@nestjs/common";
import type { ArgumentsHost } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../errors/domain-error";
import { AllExceptionsFilter } from "./all-exceptions.filter";

function mockHost(requestId = "rid") {
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

  it("maps a DomainError to its status/code and includes requestId", () => {
    const { host, res } = mockHost();
    filter.catch(new NotFoundError(), host);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const body = res.json.mock.calls[0]![0] as { code: string; requestId?: string };
    expect(body.code).toBe("NOT_FOUND");
    expect(body.requestId).toBe("rid");
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
});
