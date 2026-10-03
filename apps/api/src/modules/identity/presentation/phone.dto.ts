import { ApiProperty } from "@nestjs/swagger";
import { phoneVerificationRequestSchema, phoneVerificationConfirmSchema, phoneVerificationParamsSchema } from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class PhoneVerificationRequestDto extends createZodDto(phoneVerificationRequestSchema) {
  @ApiProperty({ example: "+905321234567", maxLength: 32 }) declare phoneNumber: string;
  @ApiProperty({ required: false, maxLength: 2048 }) declare turnstileToken?: string;
}
export class PhoneVerificationConfirmDto extends createZodDto(phoneVerificationConfirmSchema) {
  @ApiProperty({ pattern: "^\\d{6}$", minLength: 6, maxLength: 6 }) declare code: string;
}
export class PhoneVerificationParamsDto extends createZodDto(phoneVerificationParamsSchema) {}

export class PhoneStatusResponseDto {
  @ApiProperty() declare verified: boolean;
  @ApiProperty({ type: String, nullable: true }) declare maskedPhoneNumber: string | null;
  @ApiProperty() declare available: boolean;
  @ApiProperty() declare reauthenticationRequired: boolean;
}
export class PhoneVerificationResponseDto {
  @ApiProperty({ format: "uuid" }) declare challengeId: string;
  @ApiProperty({ format: "date-time" }) declare expiresAt: string;
  @ApiProperty({ format: "date-time" }) declare resendAvailableAt: string;
  @ApiProperty() declare maskedPhoneNumber: string;
  @ApiProperty({ enum: ["SENT", "UNKNOWN"] }) declare sendStatus: "SENT" | "UNKNOWN";
}
