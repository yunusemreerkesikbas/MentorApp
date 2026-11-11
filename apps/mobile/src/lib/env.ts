import { z } from "zod";

const mobileEnvSchema = z.object({
  EXPO_PUBLIC_API_URL: z
    .string()
    .url()
    .default("http://localhost:3001"),
  APP_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
});

export type MobileEnv = z.infer<typeof mobileEnvSchema>;

export function resolveMobileEnv(raw: Record<string, string | undefined> = process.env): MobileEnv {
  const parsed = mobileEnvSchema.safeParse({
    EXPO_PUBLIC_API_URL: raw["EXPO_PUBLIC_API_URL"] || undefined,
    APP_ENV: raw["APP_ENV"] || undefined,
  });
  if (!parsed.success) {
    return {
      EXPO_PUBLIC_API_URL: "http://localhost:3001",
      APP_ENV: "development",
    };
  }
  return {
    ...parsed.data,
    EXPO_PUBLIC_API_URL: parsed.data.EXPO_PUBLIC_API_URL.replace(/\/$/, ""),
  };
}

export function getApiBaseUrl(): string {
  return resolveMobileEnv().EXPO_PUBLIC_API_URL;
}
