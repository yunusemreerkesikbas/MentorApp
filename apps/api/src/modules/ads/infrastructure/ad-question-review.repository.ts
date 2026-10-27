import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { adQuestionReviews } from "../../../database/schema-ad-reviews";

@Injectable()
export class AdQuestionReviewRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  find(questionId: string, contentType: "QUESTION" | "ANNOUNCEMENT" = "QUESTION") {
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx.select().from(adQuestionReviews).where(and(eq(adQuestionReviews.questionId, questionId), eq(adQuestionReviews.contentType, contentType)));
      return row;
    });
  }

  async approve(questionId: string, contentRevision: string, reviewedBy: string, contentType: "QUESTION" | "ANNOUNCEMENT" = "QUESTION") {
    await withServiceContext(this.db, async (tx) => {
      const values = { questionId, contentType, contentRevision, reviewedBy, reviewedAt: new Date(),
        communityContentRevision: null, communityReviewedBy: null, communityReviewedAt: null };
      await tx.insert(adQuestionReviews).values(values).onConflictDoUpdate({ target: adQuestionReviews.questionId, set: values });
    });
  }

  async revoke(questionId: string, contentType: "QUESTION" | "ANNOUNCEMENT" = "QUESTION") {
    await withServiceContext(this.db, async (tx) => {
      await tx.delete(adQuestionReviews).where(and(eq(adQuestionReviews.questionId, questionId), eq(adQuestionReviews.contentType, contentType)));
    });
  }

  async approveCommunity(questionId: string, publicRevision: string, contentRevision: string, reviewedBy: string): Promise<boolean> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx.update(adQuestionReviews).set({ communityContentRevision: contentRevision,
        communityReviewedBy: reviewedBy, communityReviewedAt: new Date() })
        .where(and(eq(adQuestionReviews.questionId, questionId), eq(adQuestionReviews.contentType, "QUESTION"), eq(adQuestionReviews.contentRevision, publicRevision)))
        .returning({ questionId: adQuestionReviews.questionId });
      return rows.length === 1;
    });
  }

  async revokeCommunity(questionId: string) {
    await withServiceContext(this.db, async (tx) => {
      await tx.update(adQuestionReviews).set({ communityContentRevision: null, communityReviewedBy: null, communityReviewedAt: null })
        .where(and(eq(adQuestionReviews.questionId, questionId), eq(adQuestionReviews.contentType, "QUESTION")));
    });
  }

  async anonymizeReviewer(userId: string) {
    await withServiceContext(this.db, async (tx) => {
      await tx.update(adQuestionReviews).set({ reviewedBy: null }).where(eq(adQuestionReviews.reviewedBy, userId));
      await tx.update(adQuestionReviews).set({ communityReviewedBy: null }).where(eq(adQuestionReviews.communityReviewedBy, userId));
    });
  }
}
