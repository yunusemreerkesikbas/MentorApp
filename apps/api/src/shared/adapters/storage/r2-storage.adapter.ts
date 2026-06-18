import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Env } from "../../../config/env.validation";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import type { StoragePort, StorageUploadUrlResult } from "../../ports/storage.port";

const UPLOAD_EXPIRY_SEC = 900;

/**
 * Cloudflare R2 adapter (S3-compatible API). Requires R2_* env vars when STORAGE_PROVIDER=r2.
 */
@Injectable()
export class R2StorageAdapter implements StoragePort {
  private readonly logger = new Logger(R2StorageAdapter.name);
  private client: S3Client | null = null;
  private bucket: string | null = null;
  private publicBaseUrl: string | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  private ensureReady(): void {
    if (this.client) return;
    const accountId = this.config.get("R2_ACCOUNT_ID", { infer: true });
    const accessKeyId = this.config.get("R2_ACCESS_KEY_ID", { infer: true });
    const secretAccessKey = this.config.get("R2_SECRET_ACCESS_KEY", { infer: true });
    const bucket = this.config.get("R2_BUCKET", { infer: true });
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
    this.bucket = bucket;
    const publicBase = this.config.get("R2_PUBLIC_BASE_URL", { infer: true });
    this.publicBaseUrl =
      publicBase ?? `https://${accountId}.r2.cloudflarestorage.com/${bucket}`;
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async createUploadUrl(input: { key: string; contentType: string }): Promise<StorageUploadUrlResult> {
    this.ensureReady();
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket!,
        Key: input.key,
        ContentType: input.contentType,
      });
      const url = await getSignedUrl(this.client!, command, { expiresIn: UPLOAD_EXPIRY_SEC });
      const expiresAt = new Date(Date.now() + UPLOAD_EXPIRY_SEC * 1000).toISOString();
      return { url, key: input.key, expiresAt };
    } catch (err) {
      this.logger.error(`R2 presign failed: ${String(err)}`);
      throw new DomainError(ErrorCode.AI_PROVIDER_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  getPublicUrl(key: string): string {
    this.ensureReady();
    return `${this.publicBaseUrl!.replace(/\/$/, "")}/${key}`;
  }

  async readObject(key: string): Promise<Buffer | null> {
    this.ensureReady();
    try {
      const res = await this.client!.send(
        new GetObjectCommand({ Bucket: this.bucket!, Key: key }),
      );
      const body = res.Body;
      if (!body) return null;
      const bytes = await body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (err) {
      this.logger.warn(`R2 getObject failed for ${key}: ${String(err)}`);
      return null;
    }
  }
}
