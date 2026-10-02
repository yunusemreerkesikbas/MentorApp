/** Private self-service phone state. Never include the raw phone in a public profile. */
export interface PhoneStatusDto {
  verified: boolean;
  maskedPhoneNumber: string | null;
  available: boolean;
  reauthenticationRequired: boolean;
}

export interface PhoneVerificationDto {
  challengeId: string;
  expiresAt: string;
  resendAvailableAt: string;
  maskedPhoneNumber: string;
  sendStatus: "SENT" | "UNKNOWN";
}
