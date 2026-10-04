import { ApiProperty } from "@nestjs/swagger";
import { Currency, LedgerStatus, type EconomyLedgerEntryView, type Paginated } from "@mentor/types";

export class RewardLedgerEntryDto implements EconomyLedgerEntryView {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: Currency }) unit!: Currency;
  @ApiProperty({ type: "integer" }) amount!: number;
  @ApiProperty() reason!: string;
  @ApiProperty({ enum: LedgerStatus }) status!: LedgerStatus;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
}

export class UnseenRewardsDto implements Paginated<EconomyLedgerEntryView> {
  @ApiProperty({ type: [RewardLedgerEntryDto] }) items!: RewardLedgerEntryDto[];
  @ApiProperty({ type: "integer" }) total!: number;
  @ApiProperty({ type: "integer" }) page!: number;
  @ApiProperty({ type: "integer" }) pageSize!: number;
}
