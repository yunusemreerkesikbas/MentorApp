import { Controller, Get, HttpStatus, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { EconomyService } from "../application/economy.service";
import type { LedgerRow, Balance } from "../infrastructure/ledger.repository";
import { EconomyLedgerQueryDto } from "./economy.dto";

export interface LedgerEntryView {
  id: string;
  unit: string;
  amount: number;
  reason: string;
  status: string;
  note: string | null;
  createdAt: string;
}

const toView = (r: LedgerRow): LedgerEntryView => ({
  id: r.id,
  unit: r.unit,
  amount: r.amount,
  reason: r.reason,
  status: r.status,
  note: r.note,
  createdAt: r.createdAt.toISOString(),
});

/**
 * User-facing economy reads (W6). Self-scoped (user-context RLS). Gated by the `economy.enabled`
 * feature flag — when off the feature is dormant (404), since the economy isn't user-facing yet.
 */
@ApiTags("economy")
@ApiBearerAuth()
@Controller("economy")
export class EconomyController {
  constructor(
    private readonly economy: EconomyService,
    private readonly config: ConfigRegistryService,
  ) {}

  private async assertEnabled(): Promise<void> {
    if (!(await this.config.get("economy.enabled"))) {
      throw new DomainError(ErrorCode.ECONOMY_DISABLED, HttpStatus.NOT_FOUND);
    }
  }

  @Get("balance")
  async balance(@CurrentUser() user: RequestUser): Promise<Balance> {
    await this.assertEnabled();
    return this.economy.getSelfBalance(user.id);
  }

  @Get("ledger")
  async ledger(
    @CurrentUser() user: RequestUser,
    @Query() query: EconomyLedgerQueryDto,
  ): Promise<LedgerEntryView[]> {
    await this.assertEnabled();
    const rows = await this.economy.getSelfLedger(user.id, query.page, query.pageSize);
    return rows.map(toView);
  }
}
