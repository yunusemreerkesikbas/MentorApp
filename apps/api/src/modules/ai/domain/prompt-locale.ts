export type PromptLocale = "tr" | "en";

export function promptLocale(language?: string): PromptLocale {
  return language?.toLowerCase().startsWith("en") ? "en" : "tr";
}

export function promptLanguageInstruction(locale: PromptLocale): string {
  return locale === "en"
    ? "Write the response in English."
    : "Yanıtı Türkçe yaz.";
}
