import { paginationQuerySchema } from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class EconomyLedgerQueryDto extends createZodDto(paginationQuerySchema) {}
