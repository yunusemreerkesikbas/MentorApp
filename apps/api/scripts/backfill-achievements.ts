import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { AchievementBackfillService } from "../src/modules/community/application/achievement-backfill.service";

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const result = await app.get(AchievementBackfillService).run();
    process.stdout.write(`Achievement backfill complete: ${result.users} users, ${result.inserted} inserted\n`);
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
