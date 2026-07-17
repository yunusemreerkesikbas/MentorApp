export interface EvalCheck {
  name: string;
  severity: "hard" | "review";
  passed: boolean;
  detail: string;
}

export interface TextEvalRules {
  maxSentences?: number;
  maxItems?: number;
  plainText?: boolean;
  requiredPatterns?: RegExp[];
  forbiddenPatterns?: RegExp[];
}

export interface EvalCaseReport {
  id: string;
  model: string;
  rawOutput: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostMicros: number;
  latencyMs: number;
  checks: EvalCheck[];
}

const MARKDOWN_RE = /(^|\n)\s{0,3}(?:#{1,6}\s|[-*+]\s|>\s)|\*\*|__|\x60\x60\x60|\[[^\]]+\]\([^)]+\)/m;
const EMOJI_RE = /\p{Extended_Pictographic}/u;
const sentenceSegmenter = new Intl.Segmenter("tr", { granularity: "sentence" });

function check(
  name: string,
  passed: boolean,
  success: string,
  failure: string,
  severity: EvalCheck["severity"] = "hard",
): EvalCheck {
  return { name, severity, passed, detail: passed ? success : failure };
}

export function evaluateText(text: string, rules: TextEvalRules): EvalCheck[] {
  const trimmed = text.trim();
  const checks: EvalCheck[] = [
    check("non-empty", trimmed.length > 0, "output contains text", "output is empty"),
  ];

  if (rules.plainText) {
    const isPlain = !MARKDOWN_RE.test(text) && !EMOJI_RE.test(text);
    checks.push(check("plain-text", isPlain, "no markdown or emoji", "markdown or emoji found"));
  }

  if (rules.maxSentences != null) {
    const count = [...sentenceSegmenter.segment(trimmed)].filter((part) => /[\p{L}\p{N}]/u.test(part.segment)).length;
    checks.push(
      check(
        "max-sentences",
        count <= rules.maxSentences,
        `${count}/${rules.maxSentences} sentences`,
        `${count}/${rules.maxSentences} sentences`,
        "review",
      ),
    );
  }

  if (rules.maxItems != null) {
    const count = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
    checks.push(
      check(
        "max-items",
        count <= rules.maxItems,
        `${count}/${rules.maxItems} items`,
        `${count}/${rules.maxItems} items`,
      ),
    );
  }

  for (const [index, pattern] of (rules.requiredPatterns ?? []).entries()) {
    pattern.lastIndex = 0;
    const passed = pattern.test(text);
    checks.push(
      check(
        `required-pattern-${index + 1}`,
        passed,
        `required pattern found: ${pattern}`,
        `required pattern not found: ${pattern}`,
      ),
    );
  }

  for (const [index, pattern] of (rules.forbiddenPatterns ?? []).entries()) {
    pattern.lastIndex = 0;
    const passed = !pattern.test(text);
    checks.push(
      check(
        `forbidden-pattern-${index + 1}`,
        passed,
        `forbidden pattern absent: ${pattern}`,
        `forbidden pattern found: ${pattern}`,
      ),
    );
  }

  return checks;
}

export function renderEvalReport(cases: EvalCaseReport[]): string {
  const checks = cases.flatMap((item) => item.checks);
  const failed = checks.filter((item) => item.severity === "hard" && !item.passed).length;
  const reviewWarnings = checks.filter(
    (item) => item.severity === "review" && !item.passed,
  ).length;
  const totalCost = cases.reduce((sum, item) => sum + item.estimatedCostMicros, 0);
  const lines = [
    "# AI Prompt Eval Report",
    "",
    `Cases: ${cases.length} · Hard-check failures: ${failed} · Review warnings: ${reviewWarnings} · Estimated cost: ${totalCost} micro-USD`,
    "",
    "## Manual review rubric",
    "",
    "- Sıcak ve yargılamayan ton",
    "- Verilen bağlama sadakat",
    "- Somut ve uygulanabilir yönlendirme",
    "- Doğal, tekrar etmeyen Türkçe",
    "",
  ];

  for (const item of cases) {
    lines.push(
      `## ${item.id}`,
      "",
      `Model: ${item.model} · Latency: ${item.latencyMs} ms · Tokens: ${item.promptTokens}+${item.completionTokens} · Cost: ${item.estimatedCostMicros} micro-USD`,
      "",
      ...item.checks.map((result) => `- ${result.passed ? "PASS" : result.severity === "hard" ? "FAIL" : "REVIEW"} · ${result.severity.toUpperCase()} · ${result.name}: ${result.detail}`),
      "",
      "Output:",
      "",
      ...item.rawOutput.split(/\r?\n/).map((line) => `    ${line}`),
      "",
    );
  }

  return `${lines.join("\n").trimEnd()}\n`;
}