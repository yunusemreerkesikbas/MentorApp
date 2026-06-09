import { Module } from "@nestjs/common";
import { AcceptLanguageResolver, I18nModule, QueryResolver } from "nestjs-i18n";
import * as path from "node:path";

/**
 * Localization (§engineering-principles): the backend returns user-facing messages
 * already localized (`message` + stable `code`).
 *
 * Default + fallback = Turkish; English scaffolded. Locale resolved from `Accept-Language`
 * (or `?lang=`). An invalid/unsupported locale falls back to `tr`.
 */
@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: "tr",
      loaderOptions: {
        path: path.join(__dirname, "locales"),
        // Watch only in local development (avoids fs watchers in prod and test).
        watch: process.env.NODE_ENV === "development",
      },
      resolvers: [new QueryResolver(["lang"]), AcceptLanguageResolver],
    }),
  ],
})
export class AppI18nModule {}
