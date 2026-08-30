/** Full-bleed knowledge rail so the sidebar sits on the right of the app shell. */
export const KNOWLEDGE_PAGE_CLASS =
  "w-full px-5 py-8 lg:px-8 lg:py-10";

export const KNOWLEDGE_SPLIT_CLASS =
  "grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_17.5rem]";

/** Hub cards stay ⅓ width on desktop even when the page has only two articles. */
export const KNOWLEDGE_ARTICLE_GRID_CLASS =
  "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3";

/** Cinematic featured banner — shorter than 2:1 so the 3-col grid stays in view. */
export const KNOWLEDGE_FEATURED_ASPECT_CLASS = "aspect-[21/9]";

/** Article is a readable measure, centered between nav and the right rail. */
export const KNOWLEDGE_ARTICLE_SPLIT_CLASS =
  "grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,48rem)_minmax(0,1fr)_17.5rem]";

export const KNOWLEDGE_ARTICLE_BODY_CLASS =
  "w-full min-w-0 max-w-3xl lg:col-start-2";

export const KNOWLEDGE_ARTICLE_SIDEBAR_CLASS =
  "w-full min-w-0 lg:col-start-4 lg:border-l lg:border-[color:color-mix(in_srgb,var(--color-main)_16%,transparent)] lg:pl-8";
