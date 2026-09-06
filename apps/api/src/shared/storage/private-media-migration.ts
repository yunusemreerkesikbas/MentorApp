import {
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";

export interface LegacyPrivateObject {
  key: string;
  size: number;
}

export type LegacyPrivateMigrationResult = "planned" | "migrated";

function encodedCopySource(bucket: string, key: string): string {
  return `${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** Copy, verify, then delete. A failed/mismatched destination always leaves the public source. */
export async function migrateLegacyPrivateObject(
  client: Pick<S3Client, "send">,
  publicBucket: string,
  privateBucket: string,
  object: LegacyPrivateObject,
  apply: boolean,
): Promise<LegacyPrivateMigrationResult> {
  if (!apply) return "planned";

  const source = await client.send(
    new HeadObjectCommand({ Bucket: publicBucket, Key: object.key }),
  );
  const sourceSize = source.ContentLength ?? object.size;
  await client.send(
    new CopyObjectCommand({
      Bucket: privateBucket,
      Key: object.key,
      CopySource: encodedCopySource(publicBucket, object.key),
      MetadataDirective: "REPLACE",
      ContentType: source.ContentType ?? "application/octet-stream",
      ContentDisposition: source.ContentDisposition,
      CacheControl: "private, no-store",
    }),
  );
  const destination = await client.send(
    new HeadObjectCommand({ Bucket: privateBucket, Key: object.key }),
  );
  if (destination.ContentLength !== sourceSize) {
    throw new Error("Private destination size did not match the public source");
  }
  await client.send(new DeleteObjectCommand({ Bucket: publicBucket, Key: object.key }));
  return "migrated";
}
