/**
 * Content domain events (§8) — emitted via EventEmitter2.
 * W3 consumes ArticlePublished for embedding generation (no OpenAI in W1).
 */

export { ContentEventTopic } from "./content.constants";

export class ArticlePublished {
  constructor(
    readonly articleId: string,
    readonly slug: string,
    readonly family: string,
  ) {}
}
