import { ExamType } from "@mentor/types";

export type AdFormat = "DISPLAY" | "REWARDED";
export type AdAudienceTreatment = "NONE" | "CHILD" | "TEEN";
export type AdPolicyReason =
  | "GLOBAL_DISABLED"
  | "FORMAT_DISABLED"
  | "PLACEMENT_DISABLED"
  | "PREMIUM_AD_FREE"
  | "REGION_REQUIRES_CONSENT"
  | "ROLLOUT_EXCLUDED";

export interface AdPolicyInput {
  globalEnabled: boolean;
  formatEnabled: boolean;
  placementEnabled: boolean;
  format: AdFormat;
  countryCode: string | null;
  examType: ExamType | null;
  isPremium: boolean;
  userId: string | null;
  rolloutPercent: number;
}

export interface AdPolicyDecision {
  enabled: boolean;
  reason: AdPolicyReason | null;
  audienceTreatment: AdAudienceTreatment;
}

const CONSENT_REQUIRED_COUNTRIES = new Set([
  "AT",
  "BE",
  "BG",
  "CH",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GB",
  "GR",
  "HR",
  "HU",
  "IE",
  "IS",
  "IT",
  "LI",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
]);

function denied(reason: AdPolicyReason): AdPolicyDecision {
  return { enabled: false, reason, audienceTreatment: "NONE" };
}

/** Stable FNV-1a bucket; rollout changes do not require a user-side identifier or cookie. */
function rolloutBucket(userId: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < userId.length; index += 1) {
    hash ^= userId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 100;
}

function audienceTreatment(examType: ExamType | null): AdAudienceTreatment {
  if (examType === ExamType.LGS) return "CHILD";
  if (examType === ExamType.YKS) return "TEEN";
  return "NONE";
}

export function evaluateAdPolicy(input: AdPolicyInput): AdPolicyDecision {
  if (!input.globalEnabled) return denied("GLOBAL_DISABLED");
  if (!input.formatEnabled) return denied("FORMAT_DISABLED");
  if (!input.placementEnabled) return denied("PLACEMENT_DISABLED");
  if (input.isPremium) return denied("PREMIUM_AD_FREE");
  if (
    input.countryCode &&
    CONSENT_REQUIRED_COUNTRIES.has(input.countryCode.trim().toUpperCase())
  ) {
    return denied("REGION_REQUIRES_CONSENT");
  }
  if (
    input.format === "REWARDED" &&
    (!input.userId ||
      input.rolloutPercent <= 0 ||
      (input.rolloutPercent < 100 && rolloutBucket(input.userId) >= input.rolloutPercent))
  ) {
    return denied("ROLLOUT_EXCLUDED");
  }
  return {
    enabled: true,
    reason: null,
    audienceTreatment: audienceTreatment(input.examType),
  };
}
