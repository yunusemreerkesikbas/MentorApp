import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Env } from "../../../config/env.validation";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import type { StoragePort, StorageUploadUrlResult } from "../../ports/storage.port";

const UPLOAD_EXPIRY_SEC = 900;
const PRIVATE_PREFIX = "mock-exams/";
const PUBLIC_PREFIXES = ["avatars/", "forum/", "content/", "vision-board/"] as const;

/**
 * Cloudflare R2 adapter (S3-compatible API). Requires R2_* env vars when STORAGE_PROVIDER=r2.
 */
@Injectable()
export class R2StorageAdapter implements StoragePort {
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
    const secretAccessKey = this.config.get("R2_SECRET_ACCESS_KEY", { infer: true });
    const publicBucket = this.config.get("R2_PUBLIC_BUCKET", { infer: true });
    const privateBucket = this.config.get("R2_PRIVATE_BUCKET", { infer: true });
    const publicBaseUrl = this.config.get("R2_PUBLIC_BASE_URL", { infer: true });
    if (
      !accountId ||
      !accessKeyId ||
      !secretAccessKey ||
      !publicBucket ||
      !privateBucket ||
      !publicBaseUrl
    ) {
      throw new DomainError(ErrorCode.SERVICE_UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE);
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
    if (key.startsWith(PRIVATE_PREFIX)) return this.privateBucket!;
    if (PUBLIC_PREFIXES.some((prefix) => key.startsWith(prefix))) return this.publicBucket!;
    throw new DomainError(ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST);
  }

  async createUploadUrl(input: { key: string; contentType: string }): Promise<StorageUploadUrlResult> {
    this.ensureReady();
    const bucket = this.bucketForKey(input.key);
    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: input.key,
        ContentType: input.contentType,
      });
      const url = await getSignedUrl(this.client!, command, { expiresIn: UPLOAD_EXPIRY_SEC });
      const expiresAt = new Date(Date.now() + UPLOAD_EXPIRY_SEC * 1000).toISOString();
      return { url, key: input.key, expiresAt };
    } catch (err) {
      this.logger.error(`R2 presign failed: ${String(err)}`);
      throw new DomainError(ErrorCode.SERVICE_UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  getPublicUrl(key: string): string {
    this.ensureReady();
    if (key.startsWith(PRIVATE_PREFIX)) {
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
        const head = await this.client!.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        if (head.ContentLength == null || head.ContentLength > maxBytes) return null;
      }
      const res = await this.client!.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
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

  async deleteObject(key: string): Promise<void> {
    this.ensureReady();
    const bucket = this.bucketForKey(key);
    try {
      await this.client!.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (err) {
      this.logger.warn(`R2 deleteObject failed for ${key}: ${String(err)}`);
    }
  }
}
