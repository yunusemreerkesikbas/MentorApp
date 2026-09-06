import express, { type Express, type RequestHandler } from "express";

/** Upload capabilities stream only AFTER authentication and a bounded atomic claim. */
export function configureBodyParsers(app: Pick<Express, "use">): void {
  const json = express.json({
    limit: "1mb",
    verify: (req: express.Request & { rawBody?: Buffer }, _res, buffer) => { req.rawBody = buffer; },
  });
  const form = express.urlencoded({ extended: false, limit: "1mb" });
  const skipUpload = (parser: RequestHandler): RequestHandler => (req, res, next) => {
    if (req.method === "PUT" && /^\/v1\/storage\/uploads\/[A-Za-z0-9_-]{43}\/?$/.test(req.path)) next();
    else parser(req, res, next);
  };
  app.use(skipUpload(json));
  app.use(skipUpload(form));
}
