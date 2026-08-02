import { HttpStatus, Injectable } from "@nestjs/common";
import type {
  CoachMemoryFactDto,
  CoachProfileDto,
  Paginated,
} from "@mentor/types";
import type {
  CoachMemoryFactPatchInput,
  CoachProfilePatchInput,
} from "@mentor/validation";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { ContentService } from "../../content/application/content.service";
import { UsersService } from "../../identity/application/users.service";
import {
  isTransientMemoryKey,
  normalizeMemoryValue,
  validateMemoryCandidate,
} from "../domain/coach-memory-fact";
import type { MemoryCandidate } from "../domain/suggested-task";
import { CoachMemoryFactRepository } from "../infrastructure/coach-memory-fact.repository";
import { CoachProfileRepository } from "../infrastructure/coach-profile.repository";

@Injectable()
export class CoachProfileService {
  constructor(
    private readonly profiles: CoachProfileRepository,
    private readonly facts: CoachMemoryFactRepository,
    private readonly config: ConfigRegistryService,
    private readonly users: UsersService,
    private readonly content: ContentService,
  ) {}

  getProfile(userId: string): Promise<CoachProfileDto> {
    return this.profiles.get(userId);
  }

  patchProfile(
    userId: string,
    input: CoachProfilePatchInput,
  ): Promise<CoachProfileDto> {
    return this.profiles.patch(userId, input);
  }

  listMemories(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<Paginated<CoachMemoryFactDto>> {
    return this.facts.listPaged(userId, page, pageSize);
  }

  async getPromptMemories(userId: string): Promise<CoachMemoryFactDto[]> {
    const profile = await this.profiles.get(userId);
    if (profile.memoryConsent !== "GRANTED") return [];
    return this.facts.listActive(userId, new Date());
  }

  async learnFromChat(
    userId: string,
    sourceMessageId: string,
    userMessage: string,
    candidate: MemoryCandidate | undefined,
  ): Promise<void> {
    if (!candidate) return;
    const profile = await this.profiles.get(userId);
    if (profile.memoryConsent !== "GRANTED") return;
    const [transientTtlDays, taxonomySubjects] = await Promise.all([
      this.config.get("ai.coach.memory.transient_ttl_days"),
      this.loadTaxonomy(userId),
    ]);
    const fact = validateMemoryCandidate(userMessage, candidate, {
      now: new Date(),
      transientTtlDays,
      taxonomySubjects,
    });
    if (!fact) return;
    await this.facts.upsertChatFact(userId, sourceMessageId, {
      key: fact.key,
      value: fact.value,
      expiresAt: fact.expiresAt ? new Date(fact.expiresAt) : null,
    });
  }

  async updateMemory(
    userId: string,
    id: string,
    input: CoachMemoryFactPatchInput,
  ): Promise<CoachMemoryFactDto> {
    const existing = await this.facts.getById(userId, id);
    if (!existing) {
      throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    const normalized = normalizeMemoryValue(
      existing.key,
      input.value,
      await this.loadTaxonomy(userId),
    );
    if (!normalized) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST);
    }
    const expiresAt = isTransientMemoryKey(existing.key)
      ? new Date(
          Date.now() +
            (await this.config.get("ai.coach.memory.transient_ttl_days")) *
              24 *
              60 *
              60 *
              1000,
        )
      : null;
    const updated = await this.facts.updateByUser(
      userId,
      id,
      normalized,
      expiresAt,
    );
    if (!updated)
      throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    return updated;
  }

  async deleteMemory(userId: string, id: string): Promise<void> {
    if (!(await this.facts.deleteByUser(userId, id))) {
      throw new DomainError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
  }

  clearMemories(userId: string): Promise<void> {
    return this.facts.clear(userId);
  }

  cleanupExpired(now = new Date()): Promise<number> {
    return this.facts.deleteExpired(now);
  }

  private async loadTaxonomy(
    userId: string,
  ): Promise<Array<{ slug: string; name: string }>> {
    const me = await this.users.getMe(userId);
    if (!me.examType) return [];
    const calendar = await this.content.getExamCalendarByFamily(me.examType);
    if (!calendar) return [];
    return this.content.listExamSubjectsByExamId(calendar.exam.id);
  }
}
