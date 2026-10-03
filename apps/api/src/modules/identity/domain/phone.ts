import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export function generatePhoneCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export interface PhoneCodeBinding {
  id: string;
  userId: string;
  sessionId: string;
  phoneNumber: string;
  purpose: string;
}

export function hashPhoneCode(secret: string, binding: PhoneCodeBinding, code: string): string {
  return createHmac("sha256", secret)
    .update(JSON.stringify(["phone-otp", binding.id, binding.userId, binding.sessionId,
      binding.phoneNumber, binding.purpose, code])).digest("hex");
}

export function phoneCodeMatches(expected: string, supplied: string): boolean {
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(supplied, "hex");
  return a.length === 32 && b.length === 32 && timingSafeEqual(a, b);
}

export function phoneFingerprint(secret: string, phoneNumber: string): string {
  return createHmac("sha256", secret).update(`phone:${phoneNumber}`).digest("hex");
}

export function phoneAccountKey(secret: string, userId: string): string {
  return createHmac("sha256", secret).update(`phone-account:${userId}`).digest("hex");
}

export function maskPhone(phone: string): string {
  return `+90 5** *** ** ${phone.slice(-2)}`;
}
