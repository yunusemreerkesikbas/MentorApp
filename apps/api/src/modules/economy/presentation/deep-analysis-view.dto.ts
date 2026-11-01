import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { DeepAnalysisView } from "@mentor/types";

export class DeepAnalysisViewDto implements DeepAnalysisView {
  @ApiProperty() eligible!: boolean;
  @ApiProperty({ type: String, nullable: true }) weekStart!: string | null;
  @ApiProperty() cost!: number;
  @ApiProperty() coinConfirmed!: number;
  @ApiProperty() canAfford!: boolean;
  @ApiProperty() unlocked!: boolean;
  @ApiProperty() premium!: boolean;
  @ApiProperty() purchased!: boolean;
  @ApiProperty() generationAvailable!: boolean;
  @ApiPropertyOptional() purchaseAvailable?: boolean;
  @ApiPropertyOptional() limitReached?: boolean;
}
