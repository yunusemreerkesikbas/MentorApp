import { Module } from "@nestjs/common";
import { ContentService } from "./application/content.service";
import { ExamEventRepository } from "./infrastructure/exam-event.repository";
import { ExamRepository } from "./infrastructure/exam.repository";
import { ContentSeedService } from "./infrastructure/content-seed.service";
import { SubjectSeedService } from "./infrastructure/subject-seed.service";
import { ArticleSeedService } from "./infrastructure/article-seed.service";
import { InfoArticleRepository } from "./infrastructure/info-article.repository";
import { SubjectRepository } from "./infrastructure/subject.repository";
import { ContentController } from "./presentation/content.controller";
import { InfoArticleController } from "./presentation/info-article.controller";

/**
 * W1 — content bounded context: editorial exam calendar (Slice 1) + knowledge center (Slice 2).
 * Reference data with public read; writes via SERVICE context (seed / future W6 admin).
 */
@Module({
  controllers: [ContentController, InfoArticleController],
  providers: [
    ContentService,
    ExamRepository,
    ExamEventRepository,
    InfoArticleRepository,
    SubjectRepository,
    ContentSeedService,
    SubjectSeedService,
    ArticleSeedService,
  ],
  exports: [ContentService],
})
export class ContentModule {}
