import { describe, expect, it } from "vitest";
import { DomainError } from "../../../../common/errors/domain-error";
import { FakePaymentsAdapter, signFakeWebhook } from "./fake-payments.adapter";

const SECRET = "test-payments-webhook-secret";
const adapter = new FakePaymentsAdapter({ get: () => SECRET } as never);

describe("FakePaymentsAdapter", () => {
  it("createCheckout returns an internal success URL with the provider ref", async () => {
    const res = await adapter.createCheckout({
      userId: "u1",
      userEmail: "a@b.c",
      plan: { id: "premium-monthly", priceMinor: 24900, currency: "TRY", periodMonths: 1, trialDays: 7 },
      returnUrl: "http://localhost:3000/abonelik/sonuc",
    });
    const url = new URL(res.checkoutUrl);
    expect(url.searchParams.get("status")).toBe("success");
    expect(res.providerRef.startsWith("fake_")).toBe(true);
  });

  it("verifyWebhook accepts a correctly signed payload", () => {
    const { body, headers } = signFakeWebhook(SECRET, {
      type: "payment_succeeded",
      providerRef: "fake_x",
      amountMinor: 24900,
    });
    const event = adapter.verifyWebhook(Buffer.from(body), headers);
    expect(event.type).toBe("payment_succeeded");
    expect(event.providerRef).toBe("fake_x");
  });

  it("rejects a tampered body (signature mismatch)", () => {
    const { body, headers } = signFakeWebhook(SECRET, {
      type: "payment_succeeded",
      providerRef: "fake_x",
    });
    const tampered = Buffer.from(body.replace("payment_succeeded", "payment_failed"));
    expect(() => adapter.verifyWebhook(tampered, headers)).toThrow(DomainError);
  });

  it("rejects a missing signature", () => {
    expect(() => adapter.verifyWebhook(Buffer.from("{}"), {})).toThrow(DomainError);
  });
});
