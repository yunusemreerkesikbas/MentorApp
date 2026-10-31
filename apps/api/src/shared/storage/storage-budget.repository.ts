import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { DomainError } from "../../common/errors/domain-error";
import { ErrorCode } from "../../common/errors/error-code";
import { DRIZZLE } from "../../database/database.constants";
import type { Database } from "../../database/drizzle";
import { withServiceContext } from "../../database/rls";
import { storageBudgetState, storageObjectManifest, storageReservations } from "../../database/schema-storage-budget";
import type { StorageObjectRecord, StorageOperation, StorageReservation, StorageScope, StorageUsageLimits } from "./storage-budget.types";
import { storageScopeFingerprint } from "./storage-scope";

@Injectable()
export class StorageBudgetRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async assertScope(mode: "direct" | "bounded", fingerprint?: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      const presence = await tx.execute<{ relation: string | null }>(sql`select to_regclass('public.storage_budget_state')::text as relation`);
      if (presence.rows.length !== 1) throw unavailable();
      if (presence.rows[0]!.relation === null) {
        // Explicit legacy compatibility; bounded startup never treats missing state as free usage.
        if (mode === "direct") return;
        throw unavailable();
      }
      const [state] = await tx.select({ scopeFingerprint: storageBudgetState.scopeFingerprint, status: storageBudgetState.status })
        .from(storageBudgetState).where(eq(storageBudgetState.id, 1));
      if (mode === "direct") {
        if (state?.scopeFingerprint) throw unavailable();
      } else if (!state || state.status !== "READY" || !fingerprint || state.scopeFingerprint !== fingerprint) {
        throw unavailable();
      } else {
        const [transfer] = await tx.select({bytes:storageBudgetState.transferBytes}).from(storageBudgetState).where(eq(storageBudgetState.id,1));
        if (transfer?.bytes == null) throw unavailable();
      }
    });
  }

  async beginInitialization(scope: StorageScope, limits: StorageUsageLimits): Promise<{ id: string; probeReservations: [StorageReservation, StorageReservation] }> {
    return withServiceContext(this.db, async (tx) => {
      await tx.insert(storageBudgetState).values({ id: 1, transferBytes: 0 }).onConflictDoNothing();
      const [state] = await tx.select().from(storageBudgetState).where(eq(storageBudgetState.id, 1)).for("update");
      const fingerprint = storageScopeFingerprint(scope);
      if (!state || state.status === "READY" || state.status === "VERIFYING" || state.storedBytes !== 0 ||
          (state.scopeFingerprint && state.scopeFingerprint !== fingerprint) ||
          (!state.scopeFingerprint && (state.classA !== 0 || state.classB !== 0)) ||
          state.classA + 2 > limits.classA || state.classB > limits.classB) throw unavailable();
      const untouched = state.status === "UNINITIALIZED" && !state.scopeFingerprint &&
        state.storedBytes === 0 && state.classA === 0 && state.classB === 0;
      if (state.transferBytes === null && !untouched) throw unavailable();
      // Only the untouched pre-scope state proves zero historical payload transfer.
      const transferBytes = state.transferBytes === null ? 0 : state.transferBytes;
      if (transferBytes > limits.transferBytes || (!state.scopeFingerprint && transferBytes !== 0)) throw unavailable();
      const id = randomUUID();
      const probe = (): StorageReservation => ({ id: randomUUID(), kind: "initialization", reservedBytes: 0, reservedTransferBytes: 0, classA: 1, classB: 0 });
      const probes: [StorageReservation, StorageReservation] = [probe(), probe()];
      await tx.insert(storageReservations).values(probes.map(item => ({ ...item, initializationId: id })));
      await tx.update(storageBudgetState).set({ scopeFingerprint: fingerprint, activeInitializationId: id,
        status: "VERIFYING", classA: state.classA + 2, transferBytes, updatedAt: new Date(),
      }).where(eq(storageBudgetState.id, 1));
      return { id, probeReservations: probes };
    });
  }

  markReady(initializationId: string): Promise<void> { return this.finishInitialization(initializationId, true); }
  blockInitialization(initializationId: string): Promise<void> { return this.finishInitialization(initializationId, false); }

  private async finishInitialization(initializationId: string, ready: boolean): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      const [state] = await tx.select().from(storageBudgetState).where(eq(storageBudgetState.id, 1)).for("update");
      if (!state || state.status !== "VERIFYING" || state.activeInitializationId !== initializationId || (ready && state.transferBytes === null)) throw unavailable();
      const probes = await tx.select().from(storageReservations).where(and(eq(storageReservations.kind, "initialization"), eq(storageReservations.initializationId, initializationId)));
      if (probes.length !== 2 || (ready && probes.some(probe => probe.status !== "SUCCEEDED"))) throw unavailable();
      await tx.update(storageBudgetState).set({ status: ready ? "READY" : "BLOCKED", updatedAt: new Date() }).where(eq(storageBudgetState.id, 1));
    });
  }

  async reserve(operation: StorageOperation, limits: StorageUsageLimits): Promise<StorageReservation> {
    return withServiceContext(this.db, async (tx) => {
      const [state] = await tx.select().from(storageBudgetState).where(eq(storageBudgetState.id, 1)).for("update");
      if (!state || state.status !== "READY" || !state.scopeFingerprint || state.transferBytes === null) throw unavailable();
      const key = operation.kind === "list" ? undefined : operation.key;
      const [object] = key ? await tx.select().from(storageObjectManifest).where(eq(storageObjectManifest.key, key)) : [];
      let reservedBytes = 0;
      let reservedTransferBytes = 0;
      let classA = 0;
      let classB = 0;
      let contentType = "";
      if (operation.kind === "put") {
        if (object || !Number.isSafeInteger(operation.bytes) || operation.bytes <= 0 || operation.bytes > limits.storedBytes) throw unavailable();
        reservedBytes = operation.bytes;
        reservedTransferBytes = operation.bytes;
        contentType = operation.contentType;
        classA = 1;
      } else if (operation.kind === "copy") {
        const [source] = await tx.select().from(storageObjectManifest).where(eq(storageObjectManifest.key, operation.sourceKey));
        if (object || source?.status !== "CONFIRMED") throw unavailable();
        reservedBytes = source.bytes;
        contentType = source.contentType;
        classA = 1;
      } else if (operation.kind === "read") {
        if (object?.status !== "CONFIRMED" || (operation.maxBytes !== undefined && object.bytes > operation.maxBytes)) throw unavailable();
        classB = operation.maxBytes === undefined ? 1 : 2;
        reservedTransferBytes = object.bytes;
      } else if (operation.kind === "list") {
        classA = 1;
      } else if (!object) {
        throw unavailable();
      }
      // Privacy deletion is still possible after a cap is lowered or exhausted.
      if (operation.kind !== "delete" && (state.storedBytes + reservedBytes > limits.storedBytes ||
          state.classA + classA > limits.classA || state.classB + classB > limits.classB ||
          state.transferBytes + reservedTransferBytes > limits.transferBytes)) throw unavailable();
      const id = randomUUID();
      await tx.insert(storageReservations).values({ id, kind: operation.kind, key, reservedBytes, reservedTransferBytes, classA, classB });
      if (reservedBytes > 0 && key) {
        await tx.insert(storageObjectManifest).values({ key, bytes: reservedBytes, contentType, writeReservationId: id });
      } else if (operation.kind === "delete") {
        await tx.update(storageObjectManifest).set({ deletionSeen: true, updatedAt: new Date() }).where(eq(storageObjectManifest.key, operation.key));
      }
      await tx.update(storageBudgetState).set({ storedBytes: state.storedBytes + reservedBytes,
        classA: state.classA + classA, classB: state.classB + classB,
        transferBytes: state.transferBytes + reservedTransferBytes, updatedAt: new Date(),
      }).where(eq(storageBudgetState.id, 1));
      return { id, kind: operation.kind, key, reservedBytes, reservedTransferBytes, classA, classB };
    });
  }

  async settle(id: string, outcome: "succeeded" | "uncertain"): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      const [state] = await tx.select().from(storageBudgetState).where(eq(storageBudgetState.id, 1)).for("update");
      if (!state) throw unavailable();
      const [reservation] = await tx.select().from(storageReservations).where(eq(storageReservations.id, id));
      if (!reservation) throw unavailable();
      if (reservation.status !== "PENDING") return;
      if (reservation.key && ["put", "copy", "delete"].includes(reservation.kind)) {
        const [object] = await tx.select().from(storageObjectManifest).where(eq(storageObjectManifest.key, reservation.key));
        if (!object) throw unavailable();
        if (reservation.kind === "delete") {
          if (outcome === "succeeded" && object.status === "CONFIRMED") {
            if (state.storedBytes < object.bytes) throw unavailable();
            await tx.update(storageBudgetState).set({ storedBytes: state.storedBytes - object.bytes, updatedAt: new Date() }).where(eq(storageBudgetState.id, 1));
            await tx.update(storageObjectManifest).set({ status: "DELETED", updatedAt: new Date() }).where(eq(storageObjectManifest.key, object.key));
          } else if (object.status === "PENDING") {
            await tx.update(storageObjectManifest).set({ status: "UNCERTAIN", updatedAt: new Date() }).where(eq(storageObjectManifest.key, object.key));
          }
        } else {
          if (object.writeReservationId !== id) throw unavailable();
          // A cleanup DELETE can precede a late PUT. Its acknowledgement is not a refund.
          const status = outcome === "succeeded" && !object.deletionSeen ? "CONFIRMED" : "UNCERTAIN";
          await tx.update(storageObjectManifest).set({ status, updatedAt: new Date() }).where(eq(storageObjectManifest.key, object.key));
        }
      }
      await tx.update(storageReservations).set({ status: outcome === "succeeded" ? "SUCCEEDED" : "UNCERTAIN", settledAt: new Date() }).where(eq(storageReservations.id, id));
    });
  }

  async manifest(key: string): Promise<StorageObjectRecord | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const [object] = await tx.select().from(storageObjectManifest).where(eq(storageObjectManifest.key, key));
      if (!object || object.status === "DELETED") return undefined;
      return { key: object.key, bytes: object.bytes, contentType: object.contentType,
        state: object.status === "CONFIRMED" ? "confirmed" : "uncertain" };
    });
  }
}

function unavailable() { return new DomainError(ErrorCode.STORAGE_TEMPORARILY_UNAVAILABLE, 503); }
