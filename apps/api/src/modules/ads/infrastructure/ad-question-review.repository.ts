import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { adQuestionReviews } from "../../../database/schema-ad-reviews";

@Injectable()
export class AdQuestionReviewRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  find(questionId: string) {
    return withServiceContext(this.db, async (tx) => {
      const [row] = await tx.select().from(adQuestionReviews).where(eq(adQuestionReviews.questionId, questionId));
      return row;
    });
  }

  async approve(questionId: string, contentRevision: string, reviewedBy: string) {
    await withServiceContext(this.db, async (tx) => {
      const values = { questionId, contentRevision, reviewedBy, reviewedAt: new Date() };
      await tx.insert(adQuestionReviews).values(values).onConflictDoUpdate({ target: adQuestionReviews.questionId, set: values });
    });
  }

  async revoke(questionId: string) {
    await withServiceContext(this.db, async (tx) => {
      await tx.delete(adQuestionReviews).where(eq(adQuestionReviews.questionId, questionId));
    });
  }

  async anonymizeReviewer(userId: string) {
    await withServiceContext(this.db, async (tx) => {
      await tx.update(adQuestionReviews).set({ reviewedBy: null }).where(eq(adQuestionReviews.reviewedBy, userId));
    });
  }
}
