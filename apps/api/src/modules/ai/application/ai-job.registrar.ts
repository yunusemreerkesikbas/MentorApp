import { Injectable, type OnModuleInit } from "@nestjs/common";
import { JobRunnerService } from "../../notifications/application/job-runner.service";
import { AI_EMBED_JOB } from "../domain/ai.constants";
import { EmbedArticleHandler } from "./handlers/embed-article.handler";

/** Registers the AI job handlers on the shared runner (mirrors the W5 notifications registrar). */
@Injectable()
export class AiJobRegistrar implements OnModuleInit {
  constructor(
    private readonly runner: JobRunnerService,
    private readonly embed: EmbedArticleHandler,
  ) {}

  onModuleInit(): void {
    this.runner.registerHandler(AI_EMBED_JOB, (p) => this.embed.handle(p));
  }
}
