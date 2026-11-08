import type { Caption } from "./captions";
import type { PieceId } from "./pieces";

// Banned phrases, matched after Turkish lowercasing so "KAÇIRMA" is caught too.
const BANNED = ["son şans", "kaçırma", "duolingo"];

export function checkCopy(text: string): string[] {
  const problems: string[] = [];
  const lower = text.toLocaleLowerCase("tr");
  for (const phrase of BANNED) if (lower.includes(phrase)) problems.push(`banned phrase "${phrase}"`);
  if (/\bAI\b/.test(text)) problems.push('"AI" (write "yapay zekâ")');
  if (text.includes("—")) problems.push("em dash");
  for (const sentence of text.split(/(?<=[.!?…])\s+/)) {
    if ((sentence.match(/!/g) ?? []).length > 1) problems.push(`more than one "!" in: ${sentence}`);
  }
  return problems;
}

type Problem = { where: string; problem: string };

export function checkAll(
  copy: Partial<Record<PieceId, Record<string, string>>>,
  captions: Partial<Record<PieceId, Caption>>,
): Problem[] {
  const out: Problem[] = [];
  const add = (where: string, text: string) => checkCopy(text).forEach((problem) => out.push({ where, problem }));
  for (const [id, strings] of Object.entries(copy)) {
    for (const [key, text] of Object.entries(strings ?? {})) add(`${id}.${key}`, text);
  }
  for (const [id, c] of Object.entries(captions)) {
    if (!c) continue;
    add(`${id}.caption`, c.text);
    for (const alt of [c.alt].flat()) add(`${id}.alt`, alt);
  }
  return out;
}
