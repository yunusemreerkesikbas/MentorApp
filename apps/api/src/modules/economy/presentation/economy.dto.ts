import { ApiProperty } from "@nestjs/swagger";
import type { InviteCodeView, InviteDiscountView, InvitePreviewView } from "@mentor/types";
import { deepAnalysisSchema, economyRewardsSeenSchema, paginationQuerySchema, redeemInviteSchema } from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class EconomyLedgerQueryDto extends createZodDto(paginationQuerySchema) {}
export class RedeemInviteDto extends createZodDto(redeemInviteSchema) {}
export class DeepAnalysisDto extends createZodDto(deepAnalysisSchema) {}
export class EconomyRewardsSeenDto extends createZodDto(economyRewardsSeenSchema) {}

/** The discount in the public preview: the same shape minus the phone step (nobody is signed in yet). */
export class InvitePreviewDiscountDto implements Omit<InviteDiscountView, "phoneRequired"> {
  @ApiProperty({ enum: ["PERCENT", "FIXED"] }) discountType!: "PERCENT" | "FIXED";
  @ApiProperty({ type: "integer", description: "Percent for PERCENT, kuruş for FIXED: what checkout really applies." })
  discountValue!: number;
}

export class InviteDiscountViewDto extends InvitePreviewDiscountDto implements InviteDiscountView {
  @ApiProperty({ description: "True when the discount waits for a verified phone number." }) phoneRequired!: boolean;
}

export class InviteJoinedFriendDto {
  @ApiProperty() displayName!: string;
}

export class InviteRedeemedDto {
  @ApiProperty() inviterDisplayName!: string;
  @ApiProperty({ type: InviteDiscountViewDto, nullable: true }) discount!: InviteDiscountViewDto | null;
}

/** GET /v1/economy/invite */
export class InviteCodeViewDto implements InviteCodeView {
  @ApiProperty() code!: string;
  @ApiProperty({ type: "integer" }) rewardCoin!: number;
  @ApiProperty({ type: [InviteJoinedFriendDto], description: "Newest first, at most 20." }) joined!: InviteJoinedFriendDto[];
  @ApiProperty({ type: "integer" }) convertedCount!: number;
  @ApiProperty({ type: InviteRedeemedDto, nullable: true }) redeemed!: InviteRedeemedDto | null;
  @ApiProperty() canRedeem!: boolean;
}

/** GET /v1/economy/invite/preview/:code (public) */
export class InvitePreviewViewDto implements InvitePreviewView {
  @ApiProperty() inviterDisplayName!: string;
  @ApiProperty({ type: InvitePreviewDiscountDto, nullable: true }) discount!: InvitePreviewDiscountDto | null;
}
