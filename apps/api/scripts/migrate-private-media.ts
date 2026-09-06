import "dotenv/config";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { migrateLegacyPrivateObject } from "../src/shared/storage/private-media-migration";

const PREFIXES = ["notebook/", "vision-board/"] as const;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function client(): S3Client {
  const accountId = required("R2_ACCOUNT_ID");
  const jurisdiction = process.env.R2_JURISDICTION === "eu" ? ".eu" : "";
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}${jurisdiction}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    },
  });
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const storage = client();
  const publicBucket = required("R2_PUBLIC_BUCKET");
  const privateBucket = required("R2_PRIVATE_BUCKET");
  if (publicBucket === privateBucket) throw new Error("Public and private buckets must differ");

  let planned = 0;
  let migrated = 0;
  let failed = 0;
  for (const prefix of PREFIXES) {
    let continuationToken: string | undefined;
    do {
      const page = await storage.send(
        new ListObjectsV2Command({
          Bucket: publicBucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      for (const item of page.Contents ?? []) {
        if (!item.Key) continue;
        try {
          const result = await migrateLegacyPrivateObject(
            storage,
            publicBucket,
            privateBucket,
            { key: item.Key, size: item.Size ?? 0 },
            apply,
          );
          if (result === "planned") planned += 1;
          else migrated += 1;
        } catch {
          failed += 1;
        }
      }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);
  }

  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", planned, migrated, failed }));
  if (failed > 0) process.exitCode = 1;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Private-media migration failed");
  process.exitCode = 1;
});
