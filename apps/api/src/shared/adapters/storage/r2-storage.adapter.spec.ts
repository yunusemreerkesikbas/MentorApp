import { ConfigService } from "@nestjs/config";
import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../../config/env.validation";
import { R2StorageAdapter } from "./r2-storage.adapter";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
  return {
    ...actual,
    S3Client: vi.fn(() => ({ send })),
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async () => "https://signed.example/upload"),
}));

const ENV: Partial<Env> = {
  R2_ACCOUNT_ID: "account-id",
  R2_ACCESS_KEY_ID: "access-key",
  R2_SECRET_ACCESS_KEY: "secret-key",
  R2_PUBLIC_BUCKET: "mentor-public",
  R2_PRIVATE_BUCKET: "mentor-private",
  R2_PUBLIC_BASE_URL: "https://media.mentor.test",
  R2_JURISDICTION: "eu",
};

function adapter(overrides: Partial<Env> = {}): R2StorageAdapter {
  const values = { ...ENV, ...overrides };
  const config = {
    get: vi.fn((key: keyof Env) => values[key]),
  } as unknown as ConfigService<Env, true>;
  return new R2StorageAdapter(config);
}

describe("R2StorageAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["avatars/u/avatar.png", "forum/thread/image.webp", "content/articles/cover/a.webp"])(
    "uploads public key %s to the public bucket",
    async (key) => {
      await adapter().createUploadUrl({ key, contentType: "image/png" });

      const command = vi.mocked(getSignedUrl).mock.calls[0]?.[1] as { input: { Bucket: string } };
      expect(command.input.Bucket).toBe("mentor-public");
    },
  );

  it("uploads mock-exam photos to the private bucket", async () => {
    await adapter().createUploadUrl({
      key: "mock-exams/user-id/photo.jpg",
      contentType: "image/jpeg",
    });

    const command = vi.mocked(getSignedUrl).mock.calls[0]?.[1] as { input: { Bucket: string } };
    expect(command.input.Bucket).toBe("mentor-private");
  });

  it("reads private objects from the private bucket", async () => {
    send.mockResolvedValueOnce({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
    });

    await expect(adapter().readObject("mock-exams/user-id/photo.jpg")).resolves.toEqual(
      Buffer.from([1, 2, 3]),
    );
    expect(send.mock.calls[0]?.[0].input.Bucket).toBe("mentor-private");
  });

  it("only exposes public-object URLs", () => {
    const storage = adapter();

    expect(storage.getPublicUrl("avatars/user-id/avatar.png")).toBe(
      "https://media.mentor.test/avatars/user-id/avatar.png",
    );
    expect(() => storage.getPublicUrl("mock-exams/user-id/photo.jpg")).toThrow();
  });

  it("rejects unknown key prefixes instead of putting them in a public bucket", async () => {
    await expect(
      adapter().createUploadUrl({ key: "unknown/private.txt", contentType: "text/plain" }),
    ).rejects.toThrow();
  });

  it("uses the EU jurisdiction endpoint", () => {
    adapter().getPublicUrl("avatars/user-id/avatar.png");

    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "https://account-id.eu.r2.cloudflarestorage.com" }),
    );
  });
});
