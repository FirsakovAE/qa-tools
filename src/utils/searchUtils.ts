/**
 * Parse search term for exact match mode.
 * When wrapped in double quotes "", returns query without quotes and exactMatch: true.
 * For JSON strings, comparison is done with the text without quotes.
 */
export function parseSearchTerm(term: string): { query: string; exactMatch: boolean } {
  const trimmed = term.trim()
  const match = trimmed.match(/^"(.*)"$/s)
  if (match) {
    return { query: match[1], exactMatch: true }
  }
  return { query: trimmed, exactMatch: false }
}
