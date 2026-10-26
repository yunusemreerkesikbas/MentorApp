import { ApiProperty } from "@nestjs/swagger";
import type { MentorshipCoachRegistrationStateDto } from "@mentor/types";

/** Additive read contract; contact ownership and invitation permission are separate facts. */
export class CoachRegistrationStateResponseDto implements MentorshipCoachRegistrationStateDto {
  @ApiProperty() declare registrationOpen: boolean;
  @ApiProperty({ type: Object, nullable: true })
  declare registration: MentorshipCoachRegistrationStateDto["registration"];
  @ApiProperty() declare emailVerified: boolean;
  @ApiProperty() declare phoneVerified: boolean;
  @ApiProperty() declare hasCoach: boolean;
  @ApiProperty({ type: String, enum: ["EMAIL_UNVERIFIED", "PHONE_UNVERIFIED", "NOT_ACTIVE"], nullable: true })
  declare inviteBlockedReason: MentorshipCoachRegistrationStateDto["inviteBlockedReason"];
}
