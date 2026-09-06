import cookieParser from "cookie-parser";
import type { INestApplication } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { TestingModule } from "@nestjs/testing";
import { configureBodyParsers } from "../src/common/http/body-parsers";

/**
 * An e2e app wired like `main.ts`, by calling the same code rather than describing it again.
 *
 * Every spec used to assemble its own pipeline, and the copies drifted: the forum suite was still
 * feeding `express.raw` to `/v1/storage/fake-upload`, a route that stopped existing when uploads
 * moved to a ticketed `PUT /v1/storage/uploads/:token`. The upload tests then failed for a reason
 * that had nothing to do with uploads — the default body parser ate the request stream, so the
 * receiver read an empty body and answered 400.
 *
 * The two lines that matter, and why they cannot live anywhere else:
 *
 *   - `bodyParser: false` is a FACTORY option. Nest registers its default parsers while creating
 *     the app, before any module middleware runs, so this cannot move into `AppModule` where a
 *     test app would pick it up for free. Each app has to opt out at creation.
 *   - `configureBodyParsers` then re-adds JSON and urlencoded for every route EXCEPT the upload
 *     PUT, which needs the raw stream. It is imported from `src/`, not restated here, so the
 *     exclusion can never be true in production and stale in tests again.
 *
 * A spec that needs something extra can still do it: this returns the app UNINITIALIZED so the
 * caller stays in control of `app.init()`.
 */
export function createTestApp(moduleRef: TestingModule): INestApplication {
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: false,
    bodyParser: false,
  });
  app.setGlobalPrefix("v1");
  app.use(cookieParser());
  configureBodyParsers(app.getHttpAdapter().getInstance());
  return app;
}
