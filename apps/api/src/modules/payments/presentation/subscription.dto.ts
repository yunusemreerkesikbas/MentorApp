import { ApiExtraModels, ApiProperty, getSchemaPath } from "@nestjs/swagger";
import { SubscriptionStatus, SubscriptionTier, FeaturePolicyWindow, PREMIUM_FEATURE_IDS,
  type SubscriptionDto, type SubscriptionView, type EntitlementDto, type FeaturePolicyDto,
  type SubscriptionDiscountDto, type TrialEligibilityDto } from "@mentor/types";
import { checkoutSchema } from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class CheckoutDto extends createZodDto(checkoutSchema) {
  @ApiProperty({ maxLength: 64 }) declare planId: string;
  @ApiProperty({ required: false }) declare code?: string;
  @ApiProperty({ required: false, description: "True requires an eligible carded trial. False purchases directly. Omission preserves automatic trial selection." })
  declare useTrial?: boolean;
}

class SubscriptionResponseDto implements SubscriptionDto {
  @ApiProperty({ format: "uuid" }) declare id: string;
  @ApiProperty() declare planId: string;
  @ApiProperty({ enum: Object.values(SubscriptionStatus) }) declare status: SubscriptionDto["status"];
  @ApiProperty({ format: "date-time" }) declare startedAt: string;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) declare trialEndsAt: string | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) declare currentPeriodStart: string | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) declare currentPeriodEnd: string | null;
  @ApiProperty() declare cancelAtPeriodEnd: boolean;
  @ApiProperty() declare sponsored: boolean;
}

class EntitlementResponseDto implements EntitlementDto {
  @ApiProperty({ enum: Object.values(SubscriptionTier) }) declare tier: EntitlementDto["tier"];
  @ApiProperty() declare isPremium: boolean;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) declare validUntil: string | null;
  @ApiProperty() declare reason: string;
}

class FeaturePolicyResponseDto implements FeaturePolicyDto {
  @ApiProperty({ enum: [...PREMIUM_FEATURE_IDS] }) declare id: FeaturePolicyDto["id"];
  @ApiProperty() declare freeEnabled: boolean;
  @ApiProperty() declare limit: number;
  @ApiProperty({ enum: Object.values(FeaturePolicyWindow) }) declare window: FeaturePolicyDto["window"];
}

class SubscriptionDiscountResponseDto implements SubscriptionDiscountDto {
  @ApiProperty() declare listPriceMinor: number;
  @ApiProperty() declare discountMinor: number;
  @ApiProperty() declare chargedPriceMinor: number;
  @ApiProperty() declare periodsRemaining: number;
}

class TrialEligibilityResponseDto implements TrialEligibilityDto {
  @ApiProperty() declare eligible: boolean;
  @ApiProperty({ enum: ["AVAILABLE", "PHONE_REQUIRED", "ACCOUNT_USED", "PHONE_USED", "PENDING", "NO_TRIAL"] })
  declare reason: TrialEligibilityDto["reason"];
}

/** Response metadata only. Shared contracts and Zod remain the TypeScript/validation authority. */
@ApiExtraModels(FeaturePolicyResponseDto)
export class SubscriptionViewResponseDto implements SubscriptionView {
  @ApiProperty({ type: SubscriptionResponseDto, nullable: true }) declare subscription: SubscriptionDto | null;
  @ApiProperty({ type: EntitlementResponseDto }) declare entitlement: EntitlementDto;
  @ApiProperty({ type: "object", additionalProperties: { $ref: getSchemaPath(FeaturePolicyResponseDto) } })
  declare features: SubscriptionView["features"];
  @ApiProperty({ type: SubscriptionDiscountResponseDto, nullable: true }) declare discount: SubscriptionDiscountDto | null;
  @ApiProperty({ type: TrialEligibilityResponseDto }) declare trialEligibility: TrialEligibilityDto;
  @ApiProperty({ type: String, nullable: true }) declare pendingTrialCheckoutUrl: string | null;
  @ApiProperty({ type: String, nullable: true }) declare pendingCheckoutUrl: string | null;
}
