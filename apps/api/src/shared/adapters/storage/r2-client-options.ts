import type { S3ClientConfig } from "@aws-sdk/client-s3";

interface R2ClientSettings {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  jurisdiction: "auto" | "eu";
  mode: "direct" | "bounded";
}

export function r2ClientOptions(settings: R2ClientSettings): S3ClientConfig {
  return {
    region: "auto",
    endpoint: `https://${settings.accountId}${settings.jurisdiction === "eu" ? ".eu" : ""}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
    ...(settings.mode === "bounded" ? { maxAttempts: 1, followRegionRedirects: false } : {}),
  };
}
