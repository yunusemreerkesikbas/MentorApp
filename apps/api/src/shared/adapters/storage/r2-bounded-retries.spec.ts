import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import { r2ClientOptions } from "./r2-client-options";

const cases: {statusCode: number; code: string; headers: Record<string, string>}[] = [
  {statusCode: 503, code: "SlowDown", headers: {}},
  {statusCode: 301, code: "PermanentRedirect", headers: {"x-amz-bucket-region": "eu-west-1"}},
  {statusCode: 403, code: "RequestTimeTooSkewed", headers: {}},
];
describe("bounded R2 wire attempts", () => {
  it.each(cases)("makes one wire attempt for $statusCode $code", async ({ statusCode, code, headers: extraHeaders }) => {
    const handle = vi.fn(async () => ({ response: { statusCode,
      headers: { "content-type": "application/xml", ...extraHeaders },
      body: Buffer.from(`<Error><Code>${code}</Code><Message>fixture</Message></Error>`),
    } }));
    const options = r2ClientOptions({ accountId: "fixture-account", accessKeyId: "fixture-key", secretAccessKey: "fixture-secret", jurisdiction: "eu", mode: "bounded" });
    const client = new S3Client({ ...options, requestHandler: { handle } });
    try { await expect(client.send(new PutObjectCommand({ Bucket: "fixture-private", Key: "fixture.png", Body: Buffer.from("fixture") }))).rejects.toBeDefined(); }
    finally { client.destroy(); }
    expect(handle).toHaveBeenCalledTimes(1);
    expect(options.maxAttempts).toBe(1);
    expect(options.followRegionRedirects).toBe(false);
  });
});
