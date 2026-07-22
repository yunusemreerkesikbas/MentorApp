import { describe, expect, it } from "vitest";
import { ErrorCode } from "../../../../common/errors/error-code";
import { DisabledPaymentsAdapter } from "./disabled-payments.adapter";

describe("DisabledPaymentsAdapter", () => {
  const adapter = new DisabledPaymentsAdapter();

  it("rejects provider operations with the stable disabled code", async () => {
    await expect(adapter.cancel("provider-ref")).rejects.toMatchObject({
      code: ErrorCode.PAYMENT_DISABLED,
      httpStatus: 503,
    });
  });
});
