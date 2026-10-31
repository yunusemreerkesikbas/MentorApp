import type { StorageScope } from "./storage-budget.types";
import { parseArgs } from "node:util";
import { z } from "zod";

export interface StorageInitializationArgs {
  envFile: string;
  expectedHost: string;
  expectedDatabase: string;
  expectedUser: string;
  expectedPublicBucket: string;
  expectedPrivateBucket: string;
  expectedAccountId: string;
  abandon?: string;
}
export interface StorageInitializationInput {
  connectionString: string;
  scope: StorageScope;
  accessKeyId: string;
  secretAccessKey: string;
}
const argsSchema = z.object({
  envFile: z.string().min(1),
  expectedHost: z.string().regex(/^[a-z0-9.-]+$/),
  expectedDatabase: z.string().regex(/^[A-Za-z0-9_]+$/),
  expectedUser: z.string().regex(/^[A-Za-z0-9_]+$/),
  expectedPublicBucket: z.string().min(1),
  expectedPrivateBucket: z.string().min(1),
  expectedAccountId: z.string().regex(/^[a-f0-9]{32}$/),
  abandon: z.string().uuid().optional(),
});
const envSchema = z.object({
  NODE_ENV: z.literal("production"),
  STORAGE_ACCESS_MODE: z.literal("bounded"),
  DATABASE_URL: z.string().url(),
  R2_ACCOUNT_ID: z.string().regex(/^[a-f0-9]{32}$/),
  R2_PUBLIC_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/),
  R2_PRIVATE_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/),
  R2_JURISDICTION: z.literal("eu"),
  R2_ACCESS_KEY_ID: z.string().trim().min(1),
  R2_SECRET_ACCESS_KEY: z.string().trim().min(1),
});

export function parseStorageInitializationArgs(
  args: string[],
): StorageInitializationArgs {
  try {
    const { values, tokens } = parseArgs({
      args,
      tokens: true,
      allowPositionals: false,
      strict: true,
      options: {
        "env-file": { type: "string" },
        "expected-host": { type: "string" },
        "expected-database": { type: "string" },
        "expected-user": { type: "string" },
        "expected-account-id": { type: "string" },
        "expected-public-bucket": { type: "string" },
        "expected-private-bucket": { type: "string" },
        abandon: { type: "string" },
      },
    });
    const names = tokens
      .filter((token) => token.kind === "option")
      .map((token) => token.name);
    if (new Set(names).size !== names.length) throw invalid();
    const parsed = argsSchema.safeParse({
      envFile: values["env-file"],
      expectedHost: values["expected-host"],
      expectedDatabase: values["expected-database"],
      expectedUser: values["expected-user"],
      expectedAccountId: values["expected-account-id"],
      expectedPublicBucket: values["expected-public-bucket"],
      expectedPrivateBucket: values["expected-private-bucket"],
      abandon: values.abandon,
    });
    if (!parsed.success) throw invalid();
    return parsed.data;
  } catch {
    throw invalid();
  }
}
export function parseStorageInitializationInput(
  env: Record<string, string | undefined>,
  args: StorageInitializationArgs,
): StorageInitializationInput {
  try {
    const parsed = envSchema.safeParse(env);
    if (!parsed.success || env.DATABASE_MIGRATION_URL?.trim()) throw invalid();
    const data = parsed.data;
    const url = new URL(data.DATABASE_URL);
    const keys = [...url.searchParams.keys()];
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      url.hash ||
      !url.password ||
      data.DATABASE_URL !== data.DATABASE_URL.trim() ||
      (url.port && url.port !== "5432") ||
      url.hostname !== args.expectedHost ||
      !url.hostname.endsWith(".neon.tech") ||
      decodeURIComponent(url.pathname.slice(1)) !== args.expectedDatabase ||
      decodeURIComponent(url.username) !== args.expectedUser ||
      new Set(keys).size !== keys.length ||
      keys.some((key) => !["sslmode", "channel_binding"].includes(key)) ||
      url.searchParams.get("sslmode") !== "verify-full" ||
      (url.searchParams.has("channel_binding") &&
        url.searchParams.get("channel_binding") !== "require") ||
      data.R2_ACCOUNT_ID !== args.expectedAccountId ||
      data.R2_PUBLIC_BUCKET !== args.expectedPublicBucket ||
      data.R2_PRIVATE_BUCKET !== args.expectedPrivateBucket ||
      data.R2_PUBLIC_BUCKET === data.R2_PRIVATE_BUCKET
    )
      throw invalid();
    return {
      connectionString: data.DATABASE_URL,
      accessKeyId: data.R2_ACCESS_KEY_ID,
      secretAccessKey: data.R2_SECRET_ACCESS_KEY,
      scope: {
        accountId: data.R2_ACCOUNT_ID,
        publicBucket: data.R2_PUBLIC_BUCKET,
        privateBucket: data.R2_PRIVATE_BUCKET,
        jurisdiction: "eu",
      },
    };
  } catch {
    throw invalid();
  }
}

function invalid() {
  return new Error("Invalid storage initialization configuration.");
}
