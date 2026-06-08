import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Single API, versioned (§8): mobile can't be force-updated → /v1 backward-compatible.
  app.setGlobalPrefix("v1");
  // NOTE: Validation is done with Zod (§7), not a class-validator ValidationPipe.
  // Endpoints will bring their own Zod-based pipe.
  app.enableShutdownHooks();

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
  Logger.log(`Mentor API → http://localhost:${port}/v1`, "Bootstrap");
}

void bootstrap();
