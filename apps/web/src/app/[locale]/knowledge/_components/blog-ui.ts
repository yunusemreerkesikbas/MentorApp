/**
 * The blog's one-ink actions (2026-10-14): the panel's text link without the link blue. Colour on the
 * blog is kept for meaning only (the verified shield, the coach ledge, the active nav item).
 */
export const BLOG_ACTION =
  "inline-flex min-h-11 items-center gap-1 text-sm font-extrabold text-[var(--color-main)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";

/** A link inside running text (source, calendar): ink, always underlined. */
export const BLOG_INLINE_LINK =
  "font-extrabold text-[var(--color-main)] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]";

/** Where the last visit left "this browser belongs to a member" (see `BlogShell`). */
export const BLOG_MEMBER_HINT_KEY = "mentor.blog-member";

/**
 * Runs before the shell paints: a member's reload reserves the app chrome (sidebar offset, no visitor
 * bar) from last visit's hint instead of jumping once the session resolves. `BlogShell` corrects it.
 */
export const BLOG_MEMBER_BOOTSTRAP_SCRIPT = `try{if(localStorage.getItem("${BLOG_MEMBER_HINT_KEY}")==="1")document.documentElement.dataset.blogMember=""}catch(e){}`;
