import { HttpStatus, Injectable } from "@nestjs/common";
import type { NotebookLimitsDto } from "@mentor/types";
import { NOTEBOOK_MAX_PAGES } from "@mentor/validation";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import type { DatabaseTx } from "../../../database/drizzle";
import { MistakeNotebookRepository } from "../infrastructure/mistake-notebook.repository";
import { CoachingEntitlementRegistry } from "./coaching-entitlement.registry";

export type NotebookQuotaPolicy = Readonly<{
  isPremium: boolean;
  photoEnabled: boolean;
  photoLimit: number;
  customLimit: number;
  pagesLimit: number;
  entriesLimit: number;
}>;

/** Resolve policy before a transaction; check and mutate usage within one user lock. */
@Injectable()
export class NotebookQuotaService {
  constructor(
    private readonly config: ConfigRegistryService,
    private readonly entitlement: CoachingEntitlementRegistry,
    private readonly notebook: MistakeNotebookRepository,
  ) {}

  /** Entitlement and cold config use the pool; never resolve them inside a user transaction. */
  async resolvePolicy(userId: string, rolesHint?: string[]): Promise<NotebookQuotaPolicy> {
    const [isPremium, photoEnabled, photoLimit, customLimit, pagesLimit, entriesLimit, slots] =
      await Promise.all([
        this.entitlement.isPremium(userId, rolesHint),
        this.config.get("coaching.notebook.photo.free_enabled"),
        this.config.get("coaching.notebook.photo.free_limit"),
        this.config.get("coaching.notebook.custom.free_limit"),
        this.config.get("coaching.notebook.pages.free_limit"),
        this.config.get("coaching.notebook.entries.free_limit"),
        this.entitlement.notebookSlots(userId),
      ]);
    return { isPremium, photoEnabled, photoLimit, customLimit: customLimit + slots, pagesLimit, entriesLimit };
  }

  async resolveLimits(
    tx: DatabaseTx, userId: string, policy: NotebookQuotaPolicy,
  ): Promise<NotebookLimitsDto> {
    const usage = await this.notebook.countUserQuotaUsage(tx, userId);
    if (policy.isPremium) {
      return {
        isPremium: true, maxPages: NOTEBOOK_MAX_PAGES, maxCustomNotebooks: null,
        customNotebookCount: usage.customNotebookCount, maxEntries: null,
        entryCount: usage.entryCount, photoUploadEnabled: true, maxPhotos: null,
        photoCount: usage.photoCount,
      };
    }
    const maxPhotos = policy.photoEnabled ? policy.photoLimit : 0;
    return {
      isPremium: false, maxPages: policy.pagesLimit, maxCustomNotebooks: policy.customLimit,
      customNotebookCount: usage.customNotebookCount, maxEntries: policy.entriesLimit,
      entryCount: usage.entryCount, photoUploadEnabled: maxPhotos > usage.photoCount,
      maxPhotos, photoCount: usage.photoCount,
    };
  }

  async assertCanUploadPhoto(
    tx: DatabaseTx, userId: string, addedPhotos: number, policy: NotebookQuotaPolicy,
  ): Promise<void> {
    if (addedPhotos <= 0 || policy.isPremium) return;
    await this.notebook.lockQuotaUsage(tx, userId);
    const usage = await this.notebook.countUserQuotaUsage(tx, userId);
    this.assertPhotoLimit(policy, usage.photoCount, addedPhotos);
  }

  async assertCanCreateEntry(
    tx: DatabaseTx, userId: string, addedPhotos: number, policy: NotebookQuotaPolicy,
  ): Promise<void> {
    if (policy.isPremium) return;
    await this.notebook.lockQuotaUsage(tx, userId);
    const usage = await this.notebook.countUserQuotaUsage(tx, userId);
    if (usage.entryCount >= policy.entriesLimit) {
      throw new DomainError(ErrorCode.COACHING_NOTEBOOK_ENTRY_LIMIT_EXCEEDED,
        HttpStatus.FORBIDDEN, { limit: policy.entriesLimit, current: usage.entryCount });
    }
    if (addedPhotos > 0) this.assertPhotoLimit(policy, usage.photoCount, addedPhotos);
  }

  async assertCanCreateCustomNotebook(
    tx: DatabaseTx, userId: string, policy: NotebookQuotaPolicy,
  ): Promise<void> {
    if (policy.isPremium) return;
    if (policy.customLimit <= 0) {
      throw new DomainError(ErrorCode.PAYMENT_PREMIUM_REQUIRED, HttpStatus.FORBIDDEN);
    }
    await this.notebook.lockQuotaUsage(tx, userId);
    const usage = await this.notebook.countUserQuotaUsage(tx, userId);
    if (usage.customNotebookCount >= policy.customLimit) {
      throw new DomainError(ErrorCode.COACHING_NOTEBOOK_CUSTOM_LIMIT_EXCEEDED,
        HttpStatus.FORBIDDEN, { limit: policy.customLimit, current: usage.customNotebookCount });
    }
  }

  /** An exact saved page remains editable after a later reduction of the allowance. */
  async assertCanSavePage(
    tx: DatabaseTx, userId: string, notebookId: string, pageIndex: number,
    policy: NotebookQuotaPolicy,
  ): Promise<void> {
    if (policy.isPremium || pageIndex < policy.pagesLimit) return;
    if (await this.notebook.findPage(tx, userId, notebookId, pageIndex)) return;
    throw new DomainError(ErrorCode.COACHING_NOTEBOOK_PAGE_LIMIT_EXCEEDED,
      HttpStatus.FORBIDDEN, { limit: policy.pagesLimit });
  }

  private assertPhotoLimit(policy: NotebookQuotaPolicy, current: number, added: number): void {
    if (!policy.photoEnabled || policy.photoLimit <= 0) {
      throw new DomainError(ErrorCode.PAYMENT_PREMIUM_REQUIRED, HttpStatus.FORBIDDEN);
    }
    if (current + added > policy.photoLimit) {
      throw new DomainError(ErrorCode.COACHING_NOTEBOOK_PHOTO_LIMIT_EXCEEDED,
        HttpStatus.FORBIDDEN, { limit: policy.photoLimit, current });
    }
  }
}
