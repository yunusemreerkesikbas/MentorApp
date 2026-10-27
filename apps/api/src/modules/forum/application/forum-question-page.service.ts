import { Injectable } from "@nestjs/common";
import { forumFeedQuerySchema } from "@mentor/validation";
import type { CommunityQuestionAdSnapshot, QuestionDetail } from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ForumZoneRepository } from "../infrastructure/forum-zone.repository";
import { ForumQaService } from "./forum-qa.service";
import { ForumPublicService } from "./forum-public.service";
import { ForumDiscoveryService } from "./forum-discovery.service";
import { buildCommunityQuestionSnapshot } from "./community-question-snapshot";
import type { ThreadActor } from "./forum-thread.service";

@Injectable()
export class ForumQuestionPageService {
  constructor(private readonly qa: ForumQaService, private readonly published: ForumPublicService,
    private readonly discovery: ForumDiscoveryService, private readonly zones: ForumZoneRepository,
    private readonly config: ConfigRegistryService) {}

  async getQuestion(actor: ThreadActor, questionId: string): Promise<QuestionDetail> {
    if (!(await this.config.get("ads.placement.community_question_end.enabled"))) return this.qa.getQuestion(actor.id, questionId);
    return (await this.read(actor, questionId)).detail;
  }

  async getReviewSnapshot(actor: ThreadActor, questionId: string): Promise<CommunityQuestionAdSnapshot | null> {
    try { return (await this.read(actor, questionId)).snapshot; }
    catch (error) {
      if (error instanceof DomainError && (error.httpStatus === 404 || error.httpStatus === 403)) return null;
      throw error;
    }
  }

  private async read(actor: ThreadActor, questionId: string) {
    const [detail, published, feed] = await Promise.all([
      this.qa.getQuestion(actor.id, questionId),
      this.published.getQuestion(questionId).catch(() => null),
      this.discovery.getFeed(actor, forumFeedQuerySchema.parse({ scope: "relevant", sort: "recent", unanswered: "true", limit: 4 }))
        .catch(() => null),
    ]);
    const waiting = feed?.items.filter((item) => item.id !== questionId).slice(0, 3) ?? null;
    const zoneIds = [...new Set([detail.question.zoneId, ...(waiting ?? []).map((item) => item.zone.id)])];
    const zones = await this.zones.listPublicReviewZones(zoneIds).catch(() => []);
    const zone = zones.find((item) => item.id === detail.question.zoneId) ?? null;
    const snapshot = waiting ? buildCommunityQuestionSnapshot(published, detail, zones, waiting) : null;
    return { snapshot, detail: { ...detail, pageContext: { zone: zone ? { id: zone.id, title: zone.title, slug: zone.slug } : null,
      waitingQuestions: waiting, adContentRevision: snapshot?.contentRevision ?? null } } };
  }
}
