import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "h2",
  "h3",
  "p",
  "strong",
  "em",
  "b",
  "i",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "br",
  "hr",
  "img",
];

export function sanitizeArticleHtml(
  html: string,
  allowedImagePrefix: string,
): string {
  const sanitized = sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      th: ["scope"],
    },
    allowedSchemes: ["http", "https"],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attribs) => {
        const href = attribs.href;
        if (!href) {
          return {
            tagName: "a",
            attribs: {} as Record<string, string>,
          };
        }
        if (href.startsWith("/")) return { tagName: "a", attribs: { href } };
        return {
          tagName: "a",
          attribs: {
            href,
            target: "_blank",
            rel: "noopener noreferrer",
          },
        };
      },
      img: (_tagName, attribs) => {
        const alt = attribs.alt?.trim();
        if (!attribs.src || !alt) {
          throw new ArticleBodyError("article_image_alt_required");
        }
        if (!isAllowedImageUrl(attribs.src, allowedImagePrefix)) {
          throw new ArticleBodyError("article_image_source_invalid");
        }
        return {
          tagName: "img",
          attribs: {
            src: attribs.src,
            alt,
            ...(attribs.width ? { width: attribs.width } : {}),
            ...(attribs.height ? { height: attribs.height } : {}),
          },
        };
      },
    },
  }).trim();
  if (!toPlainText(sanitized) && !sanitized.includes("<img")) {
    throw new ArticleBodyError("article_body_empty");
  }
  return sanitized;
}

export class ArticleBodyError extends Error {}

export async function markdownToEditorHtml(
  markdown: string,
  allowedImagePrefix: string,
): Promise<string> {
  const html = await marked.parse(markdown);
  return sanitizeArticleHtml(html, allowedImagePrefix);
}

export async function articleBodyToPlainText(
  body: string,
  bodyFormat: "MARKDOWN" | "HTML",
  allowedImagePrefix: string,
): Promise<string> {
  const html =
    bodyFormat === "MARKDOWN"
      ? await markdownToEditorHtml(body, allowedImagePrefix)
      : sanitizeArticleHtml(body, allowedImagePrefix);
  return toPlainText(html);
}

function isAllowedImageUrl(src: string, prefix: string): boolean {
  if (prefix.startsWith("/")) return src.startsWith(prefix);
  try {
    const source = new URL(src);
    const allowed = new URL(prefix);
    return source.origin === allowed.origin && source.pathname.startsWith(allowed.pathname);
  } catch {
    return false;
  }
}

function toPlainText(html: string): string {
  return sanitizeHtml(html.replace(/<[^>]+>/g, " "), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, " ")
    .trim();
}
