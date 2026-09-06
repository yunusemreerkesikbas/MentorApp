import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Env } from "../../../config/env.validation";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import type {
  StorageObjectSummary,
  ObjectStoragePort,
} from "../../ports/storage.port";
import { isPrivateKey, isPublicKey } from "../../storage/storage-prefixes";


/**
 * Cloudflare R2 adapter (S3-compatible API). Requires R2_* env vars when STORAGE_PROVIDER=r2.
 */
@Injectable()
export class R2StorageAdapter implements ObjectStoragePort {
  private readonly logger = new Logger(R2StorageAdapter.name);
  private client: S3Client | null = null;
  private publicBucket: string | null = null;
  private privateBucket: string | null = null;
  private publicBaseUrl: string | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  private ensureReady(): void {
    if (this.client) return;
    const accountId = this.config.get("R2_ACCOUNT_ID", { infer: true });
    const accessKeyId = this.config.get("R2_ACCESS_KEY_ID", { infer: true });
    const secretAccessKey = this.config.get("R2_SECRET_ACCESS_KEY", {
      infer: true,
    });
    const publicBucket = this.config.get("R2_PUBLIC_BUCKET", { infer: true });
    const privateBucket = this.config.get("R2_PRIVATE_BUCKET", { infer: true });
    const publicBaseUrl = this.config.get("R2_PUBLIC_BASE_URL", {
      infer: true,
    });
    if (
      !accountId ||
      !accessKeyId ||
      !secretAccessKey ||
      !publicBucket ||
      !privateBucket ||
      !publicBaseUrl
    ) {
      throw new DomainError(
        ErrorCode.SERVICE_UNAVAILABLE,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    this.publicBucket = publicBucket;
    this.privateBucket = privateBucket;
    this.publicBaseUrl = publicBaseUrl;
    const jurisdiction = this.config.get("R2_JURISDICTION", { infer: true });
    const endpointJurisdiction = jurisdiction === "eu" ? ".eu" : "";
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}${endpointJurisdiction}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  private bucketForKey(key: string): string {
    if (isPrivateKey(key)) return this.privateBucket!;
    if (isPublicKey(key)) return this.publicBucket!;
    // Unknown prefix is rejected rather than defaulted: guessing "probably public" is how a
    // private object ends up on the internet.
    throw new DomainError(ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST);
  }

  async putObject(key: string, bytes: Buffer, contentType: string): Promise<void> {
    this.ensureReady();
    const download = contentType === "application/pdf" || contentType.startsWith("application/vnd.openxmlformats-officedocument.");
    await this.client!.send(new PutObjectCommand({ Bucket: this.bucketForKey(key), Key: key, Body: bytes, ContentLength: bytes.length, ContentType: contentType, ContentDisposition: download ? `attachment; filename="${key.split("/").at(-1)}"` : undefined, CacheControl: isPrivateKey(key) ? "private, no-store" : "public, max-age=300" }));
  }

  async createReadUrl(key: string, expiresInSeconds: number): Promise<string> {
    this.ensureReady();
    if (!isPrivateKey(key)) throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    return getSignedUrl(this.client!, new GetObjectCommand({ Bucket: this.bucketForKey(key), Key: key, ResponseCacheControl: "private, no-store" }), { expiresIn: Math.max(1, Math.min(expiresInSeconds, 300)) });
  }

  getPublicUrl(key: string): string {
    this.ensureReady();
    if (isPrivateKey(key)) {
      throw new DomainError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    this.bucketForKey(key);
    return `${this.publicBaseUrl!.replace(/\/$/, "")}/${key}`;
  }

  async readObject(key: string, maxBytes?: number): Promise<Buffer | null> {
    this.ensureReady();
    const bucket = this.bucketForKey(key);
    try {
      if (maxBytes !== undefined) {
        const head = await this.client!.send(
          new HeadObjectCommand({ Bucket: bucket, Key: key }),
        );
        if (head.ContentLength == null || head.ContentLength > maxBytes)
          return null;
      }
      const res = await this.client!.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      const body = res.Body;
      if (!body) return null;
      const bytes = await body.transformToByteArray();
      if (maxBytes !== undefined && bytes.length > maxBytes) return null;
      return Buffer.from(bytes);
    } catch (err) {
      this.logger.warn(`R2 getObject failed for ${key}: ${String(err)}`);
      return null;
    }
  }

  async listObjects(
    prefix: string,
    limit: number,
  ): Promise<StorageObjectSummary[]> {
    this.ensureReady();
    const bucket = this.bucketForKey(prefix);
    try {
      const res = await this.client!.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          MaxKeys: limit,
        }),
      );
      return (res.Contents ?? []).flatMap((item) =>
        item.Key
          ? [{ key: item.Key, lastModified: item.LastModified ?? null }]
          : [],
      );
    } catch (err) {
      // A sweep must never take the caller down; an empty page just means "nothing to do now".
      this.logger.warn(`R2 listObjects failed for ${prefix}: ${String(err)}`);
      return [];
    }
  }

  async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
    this.ensureReady();
    const sourceBucket = this.bucketForKey(sourceKey);
    const destinationBucket = this.bucketForKey(destinationKey);
    // Not best-effort, unlike `deleteObject`: the caller is about to hand the destination key back
    // as an attachment, and a silently skipped copy would produce a post pointing at nothing.
    await this.client!.send(
      new CopyObjectCommand({
        Bucket: destinationBucket,
        Key: destinationKey,
        CopySource: `${sourceBucket}/${sourceKey}`,
      }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    this.ensureReady();
    await this.client!.send(new DeleteObjectCommand({ Bucket: this.bucketForKey(key), Key: key }));
  }
}
