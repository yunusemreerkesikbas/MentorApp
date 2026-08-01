import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ForumZoneRepository } from "./forum-zone.repository";

interface SeedZone {
  /** STABLE key — the seed never re-slugifies (ForumService.slugify appends a timestamp). */
  slug: string;
  type: string;
  title: string;
  description: string | null;
  emoji: string | null;
  joinPolicy: string;
}

interface SeedFile {
  zones: SeedZone[];
}

/**
 * Seeds the launch zones on startup (idempotent upserts on the unique slug), so the community hub
 * can recommend useful rooms on flip day instead of becoming an empty dead end. Runs regardless
 * of `forum.enabled`: the rows stay invisible while the flag is off, and the flip is instant.
 * Mirrors the content seed services.
 */
@Injectable()
export class ForumZoneSeedService implements OnModuleInit {
  private readonly logger = new Logger(ForumZoneSeedService.name);

  constructor(private readonly zones: ForumZoneRepository) {}

  async onModuleInit(): Promise<void> {
    try {
      const path = resolve(__dirname, "../seed/zones.seed.json");
      const raw = readFileSync(path, "utf8");
      const data = JSON.parse(raw) as SeedFile;

      let created = 0;
      for (const zone of data.zones) {
        const inserted = await this.zones.seedZone({
          slug: zone.slug,
          type: zone.type,
          title: zone.title,
          description: zone.description,
          emoji: zone.emoji,
          joinPolicy: zone.joinPolicy,
        });
        if (inserted) created += 1;
      }

      this.logger.log(
        `Forum zone seed applied (${data.zones.length} zones, ${created} created).`,
      );
    } catch (err) {
      // Never crash boot for a seed problem — the community tab degrades, the app still runs.
      this.logger.error("Forum zone seed failed — /topluluk may be empty until fixed.", err);
    }
  }
}
