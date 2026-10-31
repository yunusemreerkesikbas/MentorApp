import { Injectable } from "@nestjs/common";
import { ConfigRegistryService } from "../../common/config/config-registry.service";
import { DomainError } from "../../common/errors/domain-error";
import { ErrorCode } from "../../common/errors/error-code";
import { StorageBudgetRepository } from "./storage-budget.repository";
import type {
  StorageOperation,
  StorageReservation,
  StorageScope,
  StorageUsageLimits,
} from "./storage-budget.types";
import { validateStorageOperation } from "./storage-budget.validation";

@Injectable()
export class StorageBudgetService {
  constructor(
    private readonly repository: StorageBudgetRepository,
    private readonly config: ConfigRegistryService,
  ) {}

  async run<T>(
    operation: StorageOperation,
    invoke: () => Promise<T>,
  ): Promise<T> {
    validateStorageOperation(operation);
    const reservation = await this.repository.reserve(
      operation,
      await this.limits(),
    );
    let result: T;
    try {
      result = await invoke();
      if (operation.kind === "read" && result === null) throw unavailable();
    } catch (error) {
      await this.finalize(reservation.id, "uncertain");
      if (error instanceof DomainError) throw error;
      throw unavailable();
    }
    // Settlement failure must never re-invoke or relabel a successful side effect.
    await this.finalize(reservation.id, "succeeded");
    return result;
  }

  async beginInitialization(scope: StorageScope) {
    return this.repository.beginInitialization(scope, await this.limits());
  }
  markReady(id: string) {
    return this.repository.markReady(id);
  }
  blockInitialization(id: string) {
    return this.repository.blockInitialization(id);
  }
  recordInitializationProbe(
    reservation: StorageReservation,
    outcome: "succeeded" | "uncertain",
  ) {
    if (reservation.kind !== "initialization") throw unavailable();
    return this.repository.settle(reservation.id, outcome);
  }

  private async limits(): Promise<StorageUsageLimits> {
    const [storedBytes, classA, classB, transferBytes] = await Promise.all([
      this.config.get("storage.budget.max_stored_bytes"),
      this.config.get("storage.budget.max_class_a"),
      this.config.get("storage.budget.max_class_b"),
      this.config.get("storage.budget.max_transfer_bytes"),
    ]);
    return { storedBytes, classA, classB, transferBytes };
  }

  private async finalize(
    id: string,
    outcome: "succeeded" | "uncertain",
  ): Promise<void> {
    try {
      await this.repository.settle(id, outcome);
    } catch {
      throw unavailable();
    }
  }
}

function unavailable() {
  return new DomainError(ErrorCode.STORAGE_TEMPORARILY_UNAVAILABLE, 503);
}
