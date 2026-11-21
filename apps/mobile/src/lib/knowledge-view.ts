import { EXAM_TYPES, type ExamType, type InfoArticleBodyFormat } from "@mentor/types";
import type { AppLocale } from "../stores/preferences.js";

export const ARTICLE_CATEGORIES = [
  "APPLICATION",
  "EXAM_PROCESS",
  "GENERAL",
] as const;

export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];

export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  href?: string;
}

export type MarkdownBlock =
  | { kind: "heading"; level: 2 | 3; runs: InlineRun[] }
  | { kind: "paragraph"; runs: InlineRun[] }
  | { kind: "blockquote"; blocks: { runs: InlineRun[] }[] }
  | { kind: "list"; ordered: boolean; items: InlineRun[][] }
  | {
      kind: "table";
      headers: InlineRun[][];
      alignments: ("left" | "center" | "right")[];
      rows: InlineRun[][][];
    };

export function resolveExamFamilyParam(
  rawFamily: string | undefined,
  userExamType: ExamType | null | undefined,
): ExamType {
  const normalized = rawFamily?.trim().toUpperCase();
  const matched = EXAM_TYPES.find((f) => f === normalized);
  if (matched) return matched;
  if (userExamType && EXAM_TYPES.includes(userExamType)) return userExamType;
  return "KPSS";
}

export function showsFeaturedArticle(
  featured: { category: string } | null | undefined,
  category: ArticleCategory | null,
  page: number,
): boolean {
  return Boolean(
    featured && page === 1 && (category === null || featured.category === category),
  );
}

export function resolveContentMediaUrl(url: string, apiBase: string): string {
  if (!url) return url;
  if (url.startsWith("/")) {
    return `${apiBase.replace(/\/$/, "")}${url}`;
  }
  return url;
}

export function isSafeHttpUrl(url: string | null | undefined): url is string {
  return typeof url === "string" && (url.startsWith("https://") || url.startsWith("http://"));
}

/**
 * Extracts an internal article slug from web-authored links like `/blog/slug`, `/bilgi/slug`,
 * `http://localhost:3000/blog/slug`, or `https://puhukoc.com/en/knowledge/slug`.
 */
export function extractInternalArticleSlug(href: string | undefined): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  let path = trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      if (
        parsed.hostname !== "localhost" &&
        parsed.hostname !== "127.0.0.1" &&
        !parsed.hostname.endsWith("puhukoc.com")
      ) {
        return null;
      }
      path = parsed.pathname;
    } catch {
      return null;
    }
  } else if (!trimmed.startsWith("/")) {
    return null;
  }

  const clean = path.split("?")[0]?.split("#")[0] ?? "";
  const withoutLocale = clean.replace(/^\/(tr|en)(?=\/|$)/, "");
  const match = withoutLocale.match(/^\/(?:blog|bilgi|knowledge)\/([^/]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/** Mirrors `apps/web/src/lib/article-provenance.ts` so source blocks live in one trust card. */
export function splitArticleProvenance(
  body: string,
  format: InfoArticleBodyFormat,
): { body: string; scope: string | null; citation: string | null } {
  if (format !== "MARKDOWN") return { body, scope: null, citation: null };
  let scope: string | null = null;
  let citation: string | null = null;
  const content = body
    .replace(
      /^> (?:\*\*)?Kaynak kapsamı:(?:\*\*)?([^\n]*(?:\n>[^\n]*)*)/m,
      (_, text: string) => {
        scope = text.replace(/\n>\s?/g, "\n").trim();
        return "";
      },
    )
    .replace(
      /^## Kaynak(?:lar)?[ \t]*\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/m,
      (_, text: string) => {
        citation = text.trim();
        return "";
      },
    );
  return { body: content.trim(), scope, citation };
}

const WORDS_PER_MINUTE = 200;

export function estimateReadingMinutes(
  body: string,
  format: InfoArticleBodyFormat,
): number {
  const text =
    format === "HTML"
      ? body.replace(/<[^>]*>/g, " ")
      : body.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#>*_`~|]/g, " ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

export function formatShortGuideDate(iso: string, locale: AppLocale): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function parseInlineRuns(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const pattern = /(\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      runs.push({ text: text.slice(cursor, match.index) });
    }
    if (match[2] !== undefined && match[3] !== undefined) {
      runs.push({ text: match[2], href: match[3] });
    } else if (match[4] !== undefined) {
      runs.push({ text: match[4], bold: true });
    } else if (match[5] !== undefined) {
      runs.push({ text: match[5], code: true });
    } else if (match[6] !== undefined) {
      runs.push({ text: match[6], italic: true });
    }
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    runs.push({ text: text.slice(cursor) });
  }
  return runs.length > 0 ? runs : [{ text }];
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c));
}

function parseAlignments(line: string): ("left" | "center" | "right")[] {
  return splitTableRow(line).map((cell) => {
    if (cell.startsWith(":") && cell.endsWith(":")) return "center";
    if (cell.endsWith(":")) return "right";
    return "left";
  });
}

function htmlToMarkdownBlocks(html: string): MarkdownBlock[] {
  const stripped = html
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  return stripped
    .split(/\n{2,}/)
    .map((chunk) => chunk.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((text) => ({ kind: "paragraph" as const, runs: [{ text }] }));
}

export function parseMarkdownBlocks(
  body: string,
  format: InfoArticleBodyFormat = "MARKDOWN",
): MarkdownBlock[] {
  if (format === "HTML") return htmlToMarkdownBlocks(body);

  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
      const level = trimmed.startsWith("### ") ? 3 : 2;
      const content = trimmed.slice(level + 1).trim();
      blocks.push({ kind: "heading", level, runs: parseInlineRuns(content) });
      i += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith(">")) {
        quoteLines.push((lines[i] ?? "").trim().replace(/^>\s?/, ""));
        i += 1;
      }
      const quoteParagraphs = quoteLines
        .join("\n")
        .split(/\n{2,}/)
        .map((part) => part.replace(/\n+/g, " ").trim())
        .filter(Boolean)
        .map((part) => ({ runs: parseInlineRuns(part) }));
      if (quoteParagraphs.length > 0) {
        blocks.push({ kind: "blockquote", blocks: quoteParagraphs });
      }
      continue;
    }

    if (trimmed.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1] ?? "")) {
      const headers = splitTableRow(trimmed).map(parseInlineRuns);
      const alignments = parseAlignments(lines[i + 1] ?? "");
      i += 2;
      const rows: InlineRun[][][] = [];
      while (i < lines.length) {
        const rowLine = (lines[i] ?? "").trim();
        if (!rowLine || !rowLine.includes("|")) break;
        rows.push(splitTableRow(rowLine).map(parseInlineRuns));
        i += 1;
      }
      blocks.push({ kind: "table", headers, alignments, rows });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const ordered = /^\d+\.\s+/.test(trimmed);
      const itemRegex = ordered ? /^\d+\.\s+(.*)$/ : /^[-*]\s+(.*)$/;
      const items: InlineRun[][] = [];
      while (i < lines.length) {
        const cur = (lines[i] ?? "").trim();
        const m = cur.match(itemRegex);
        if (!m?.[1]) break;
        items.push(parseInlineRuns(m[1]));
        i += 1;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    const paraLines: string[] = [];
    while (i < lines.length) {
      const cur = (lines[i] ?? "").trim();
      if (
        !cur ||
        cur.startsWith("## ") ||
        cur.startsWith("### ") ||
        cur.startsWith(">") ||
        /^[-*]\s+/.test(cur) ||
        /^\d+\.\s+/.test(cur) ||
        (cur.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1] ?? ""))
      ) {
        break;
      }
      paraLines.push(cur);
      i += 1;
    }
    if (paraLines.length > 0) {
      blocks.push({ kind: "paragraph", runs: parseInlineRuns(paraLines.join(" ")) });
    }
  }

  return blocks;
}
