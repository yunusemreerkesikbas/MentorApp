import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { ExamType, type PublicDiscoveryQuestion, type PublicQuestionRef, type PublicQuestionView } from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { ForumThreadRepository } from "../infrastructure/forum-thread.repository";
import { ForumPostRepository } from "../infrastructure/forum-post.repository";

function publicExamType(value: string | null): ExamType | null {
  return Object.values(ExamType).find((type) => type === value) ?? null;
}

/**
 * Public (anonymous, SEO) reads — only INDEXABLE QA questions (QA + PUBLIC zone, not archived,
 * thread not deleted, ≥1 non-deleted answer). Service-context reads (forum tables are RLS-forced);
 * the repo WHERE clauses are the gate. Returns slim shapes (no authorId/PII). Gated by `forum.enabled`.
 */
@Injectable()
export class ForumPublicService {
  constructor(
    private readonly threads: ForumThreadRepository,
    private readonly posts: ForumPostRepository,
    private readonly config: ConfigRegistryService,
  ) {}

  private async enabled(): Promise<boolean> {
    return Boolean(await this.config.get("forum.enabled"));
  }

  private async discoveryIds(): Promise<string[]> {
    const value = await this.config.get("forum.discovery_question_ids");
    return [...new Set(value.split(",").map((id) => id.trim().toLowerCase()).filter(Boolean))];
  }

  /** An indexable QA question with its answers, or null (→ 404 / noindex). */
  async getQuestion(threadId: string): Promise<PublicQuestionView | null> {
    if (!(await this.enabled())) return null;
    const thread = await this.threads.findPublicQuestion(threadId);
    if (!thread) return null;
    const answers = await this.posts.listPublicAnswers(threadId);
    if (answers.length === 0) return null;
    // Include timestamps so editing back to old text cannot resurrect a previous approval.
    const contentRevision = createHash("sha256").update(JSON.stringify({
      id: thread.id, title: thread.title, body: thread.body, updatedAt: thread.updatedAt,
      zoneUpdatedAt: thread.zoneUpdatedAt, examType: thread.examType,
      answers: answers.map((a) => [a.id, a.body, a.isAccepted, a.updatedAt]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    })).digest("hex");
    return {
      discoverable: (await this.discoveryIds()).includes(thread.id),
      contentRevision,
      examType: publicExamType(thread.examType),
      id: thread.id,
      title: thread.title ?? "",
      body: thread.body,
      createdAt: thread.createdAt.toISOString(),
      answers: answers.map((a) => ({
        id: a.id,
        body: a.body,
        isAccepted: a.isAccepted,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  /** Indexable QA question refs for the sitemap. */
  async listQuestionRefs(limit: number): Promise<PublicQuestionRef[]> {
    if (!(await this.enabled())) return [];
    const refs = await this.threads.listPublicQuestionRefs(limit);
    return refs.map((r) => ({ id: r.id, updatedAt: r.updatedAt.toISOString() }));
  }

  async listDiscoveryQuestions(): Promise<PublicDiscoveryQuestion[]> {
    if (!(await this.enabled())) return [];
    const ids = await this.discoveryIds();
    if (ids.length === 0) return [];
    const rows = await this.threads.listDiscoveryQuestions(ids);
    return rows.map((row) => ({
      id: row.id,
      title: row.title ?? "",
      examType: publicExamType(row.examType),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }
}
