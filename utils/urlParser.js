/**
 * Parses text content and extracts URLs in order.
 * Supports common list formats:
 * - 1. https://...
 * - 2) https://...
 * - 1 - https://...
 * - - https://...
 * - * https://...
 * - • https://...
 * - Plain lines with just the URL
 */
const URL_REGEX = /https?:\/\/[^\s\]\)"'<>]+/gi;

function stripListPrefix(line) {
  const trimmed = line.trim();
  // Remove leading: "1.", "1)", "1 -", "1-", "- ", "* ", "• ", "1) ", etc.
  const withoutNumber = trimmed.replace(/^\s*\d+[.)]\s*/, '');           // 1. or 1)
  const withoutDash = withoutNumber.replace(/^\s*\d*\s*[-–—]\s*/, '');   // - or 1 -
  const withoutBullet = withoutDash.replace(/^\s*[*•·]\s*/, '');         // * or •
  return withoutBullet.trim();
}

export function parseUrlsFromText(text) {
  if (!text || typeof text !== 'string') return [];
  const lines = text.split(/\r?\n/);
  const seen = new Set();
  const urls = [];
  for (const line of lines) {
    const cleaned = stripListPrefix(line);
    const matches = cleaned.match(URL_REGEX);
    if (matches) {
      for (const url of matches) {
        const normalized = url.replace(/[.,;:!?)]+$/, ''); // trim trailing punctuation
        if (!seen.has(normalized)) {
          seen.add(normalized);
          urls.push(normalized);
        }
      }
    }
    // Also try the whole line as a single URL (in case regex missed)
    const wholeLineUrl = cleaned.match(/^https?:\/\/\S+$/);
    if (wholeLineUrl) {
      const u = wholeLineUrl[0].replace(/[.,;:!?)]+$/, '');
      if (!seen.has(u)) {
        seen.add(u);
        urls.push(u);
      }
    }
  }
  return urls;
}
