import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../../config/env.validation";

/** Delivery acceptance is never treated as phone ownership. UNKNOWN may already have sent. */
export type SmsSendResult = { status: "SENT" | "UNKNOWN" | "FAILED"; jobId?: string };

@Injectable()
export class NetgsmSmsAdapter {
  constructor(private readonly config: ConfigService<Env, true>) {}

  isAvailable(): boolean {
    return this.config.get("SMS_PROVIDER", { infer: true }) === "netgsm" &&
      Boolean(this.config.get("NETGSM_USERCODE", { infer: true }) &&
        this.config.get("NETGSM_API_PASSWORD", { infer: true }) &&
        this.config.get("NETGSM_MSGHEADER", { infer: true }));
  }

  async sendCode(phoneNumber: string, code: string, timeoutMs: number, ttlSeconds: number): Promise<SmsSendResult> {
    if (!this.isAvailable()) return { status: "FAILED" };
    const username = this.config.get("NETGSM_USERCODE", { infer: true });
    const password = this.config.get("NETGSM_API_PASSWORD", { infer: true });
    try {
      const result = await fetch("https://api.netgsm.com.tr/sms/rest/v2/otp", {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(timeoutMs),
        headers: { "content-type": "application/json", authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` },
        body: JSON.stringify({
          msgheader: this.config.get("NETGSM_MSGHEADER", { infer: true }),
          no: phoneNumber.slice(3),
          msg: `Mentor dogrulama kodun: ${code}. ${Math.ceil(ttlSeconds / 60)} dakika gecerli. Bu kodu kimseyle paylasma.`,
        }),
      });
      // A transport/proxy failure does not establish whether the provider accepted the SMS.
      if (!result.ok) return { status: "UNKNOWN" };
      const body: unknown = await result.json();
      if (!body || typeof body !== "object" || !("code" in body)) return { status: "UNKNOWN" };
      if (body.code === "00" && "jobid" in body && typeof body.jobid === "string") {
        return { status: "SENT", jobId: body.jobid };
      }
      return typeof body.code === "string" && ["20", "30", "40", "41", "50", "51", "52", "60", "70"].includes(body.code)
        ? { status: "FAILED" } : { status: "UNKNOWN" };
    } catch {
      // Do not log exception text, request/response bodies, phone, code, or credentials.
      return { status: "UNKNOWN" };
    }
  }
}
