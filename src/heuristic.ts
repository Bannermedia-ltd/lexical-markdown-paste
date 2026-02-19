/**
 * Scoring rules for markdown heuristic detection.
 * Each rule tests a pattern and awards points if matched.
 */
interface ScoringRule {
  pattern: RegExp;
  points: number;
}

const SCORING_RULES: ScoringRule[] = [
  // Headings: # followed by space at line start
  { pattern: /^#{1,6} \S/m, points: 2 },

  // Bold: **text**
  { pattern: /\*\*[^*\n]+\*\*/, points: 1 },

  // Italic with underscores: _text_
  { pattern: /_[^_\n]+_/, points: 1 },

  // Italic with asterisks: *text* (not **)
  { pattern: /(?<!\*)\*(?!\*)([^*\n]+)(?<!\*)\*(?!\*)/, points: 1 },

  // Unordered list: line starting with "- " or "* "
  // Must have at least one item
  { pattern: /^[*-] \S/m, points: 2 },

  // Ordered list: line starting with "1. "
  { pattern: /^\d+\. \S/m, points: 2 },

  // Fenced code block: triple backticks
  { pattern: /```/, points: 2 },

  // Inline code: `code`
  { pattern: /`[^`\n]+`/, points: 1 },

  // Link: [text](url)
  { pattern: /\[[^\]]+\]\([^)]+\)/, points: 2 },

  // Blockquote: line starting with "> "
  { pattern: /^> /m, points: 2 },

  // Horizontal rule: "---" or "***" on its own line
  { pattern: /^(-{3,}|\*{3,})$/m, points: 1 },
];

/**
 * Patterns that indicate the text is NOT markdown,
 * used to zero out the score.
 */
const EXCLUSION_PATTERNS: RegExp[] = [
  // HTML tags
  /<[a-zA-Z][^>]*>/,
];

const DEFAULT_THRESHOLD = 2;

/**
 * Calculates a markdown likelihood score for the given text.
 * Higher scores indicate more markdown-like content.
 */
export function getMarkdownScore(text: string): number {
  if (!text.trim()) return 0;

  for (const exclusion of EXCLUSION_PATTERNS) {
    if (exclusion.test(text)) return 0;
  }

  let score = 0;
  for (const rule of SCORING_RULES) {
    if (rule.pattern.test(text)) {
      score += rule.points;
    }
  }

  return score;
}

/**
 * Returns true if the text is likely markdown,
 * scoring above the given threshold (default 2).
 */
export function isLikelyMarkdown(
  text: string,
  threshold = DEFAULT_THRESHOLD,
): boolean {
  return getMarkdownScore(text) >= threshold;
}
