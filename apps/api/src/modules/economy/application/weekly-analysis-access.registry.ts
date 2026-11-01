import { HttpStatus, Injectable } from "@nestjs/common";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";

export interface WeeklyAnalysisAccessPort {
  isIncluded(userId: string, roles: string[]): Promise<boolean>;
  canGenerate(): Promise<boolean>;
  acquire(): Promise<string | null>;
  release(reservationId: string | null): Promise<void>;
}

/** AI registers its public policy without introducing an Economy → AI module dependency. */
@Injectable()
export class WeeklyAnalysisAccessRegistry {
  private access?: WeeklyAnalysisAccessPort;

  register(access: WeeklyAnalysisAccessPort): void {
    this.access = access;
  }

  get(): WeeklyAnalysisAccessPort {
    if (!this.access)
      throw new DomainError(ErrorCode.AI_DISABLED, HttpStatus.NOT_FOUND);
    return this.access;
  }
}
