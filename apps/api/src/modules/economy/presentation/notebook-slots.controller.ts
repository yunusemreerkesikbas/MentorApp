import { Body, Controller, Get, HttpStatus, Post } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
} from "@nestjs/swagger";
import type { NotebookSlotView } from "@mentor/types";
import { notebookSlotPurchaseSchema } from "@mentor/validation";
import {
  CurrentUser,
  type RequestUser,
} from "../../../common/auth/current-user";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { IdempotencyKey } from "../../../common/http/idempotency-key.decorator";
import { createZodDto } from "../../../common/validation/zod-dto";
import { NotebookSlotService } from "../application/notebook-slot.service";

class NotebookSlotPurchaseDto extends createZodDto(notebookSlotPurchaseSchema) {
  @ApiProperty({ minimum: 1, maximum: 100000 }) declare expectedCost: number;
  @ApiProperty({ minimum: 0, maximum: 50 })
  declare expectedPurchasedSlots: number;
}

class NotebookSlotViewDto implements NotebookSlotView {
  @ApiProperty({
    enum: [
      "AVAILABLE",
      "INSUFFICIENT_COIN",
      "LIMIT_REACHED",
      "PREMIUM_INCLUDED",
    ],
  })
  status!: NotebookSlotView["status"];
  @ApiProperty() cost!: number;
  @ApiProperty() coinConfirmed!: number;
  @ApiProperty() purchasedSlots!: number;
  @ApiProperty() maxPurchasableSlots!: number;
  @ApiProperty() premium!: boolean;
  @ApiProperty() canAfford!: boolean;
  @ApiProperty() canPurchase!: boolean;
}

@ApiTags("economy")
@ApiBearerAuth()
@Controller("economy/notebook-slots")
export class NotebookSlotsController {
  constructor(private readonly slots: NotebookSlotService) {}

  @Get()
  @ApiOkResponse({ type: NotebookSlotViewDto })
  state(@CurrentUser() user: RequestUser): Promise<NotebookSlotView> {
    return this.slots.getState(user.id, user.roles);
  }

  @Post()
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    description: "UUID; reuse for retries of this purchase.",
  })
  @ApiCreatedResponse({ type: NotebookSlotViewDto })
  purchase(
    @CurrentUser() user: RequestUser,
    @Body() dto: NotebookSlotPurchaseDto,
    @IdempotencyKey() key?: string,
  ): Promise<NotebookSlotView> {
    if (!key)
      throw new DomainError(ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST);
    return this.slots.purchase(user.id, user.roles, key, dto);
  }
}
