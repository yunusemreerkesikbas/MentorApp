import { paginationQuerySchema, redeemInviteSchema } from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class EconomyLedgerQueryDto extends createZodDto(paginationQuerySchema) {}
export class RedeemInviteDto extends createZodDto(redeemInviteSchema) {}
