import { Module } from "@nestjs/common";
import { ContentService } from "./application/content.service";
import { ExamEventRepository } from "./infrastructure/exam-event.repository";
import { ExamRepository } from "./infrastructure/exam.repository";
import { ContentSeedService } from "./infrastructure/content-seed.service";
import { SubjectSeedService } from "./infrastructure/subject-seed.service";
import { ArticleSeedService } from "./infrastructure/article-seed.service";
import { InfoArticleRepository } from "./infrastructure/info-article.repository";
import { HolidaySeedService } from "./infrastructure/holiday-seed.service";
import { PublicHolidayRepository } from "./infrastructure/public-holiday.repository";
import { SubjectRepository } from "./infrastructure/subject.repository";
import { TopicRepository } from "./infrastructure/topic.repository";
import { ContentController } from "./presentation/content.controller";
import { InfoArticleController } from "./presentation/info-article.controller";
import { PublicHolidayController } from "./presentation/public-holiday.controller";

/**
 * W1 — content bounded context: editorial exam calendar (Slice 1) + knowledge center (Slice 2).
 * Reference data with public read; writes via SERVICE context (seed / future W6 admin).
 */
@Module({
  controllers: [ContentController, InfoArticleController, PublicHolidayController],
  providers: [
    ContentService,
    ExamRepository,
    ExamEventRepository,
    InfoArticleRepository,
    PublicHolidayRepository,
    SubjectRepository,
    TopicRepository,
    ContentSeedService,
    SubjectSeedService,
    ArticleSeedService,
    HolidaySeedService,
  ],
  exports: [ContentService],
})
export class ContentModule {}
