const URL_REGEX = /https?:\/\/[^\s]+$/
const segmenter = new Intl.Segmenter()

export function renderTemplate(
  template: string,
  variables: Record<string, string | undefined>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '')
}

function graphemeLength(text: string): number {
  return [...segmenter.segment(text)].length
}

function sliceGraphemes(text: string, count: number): string {
  return [...segmenter.segment(text)].slice(0, count).map(s => s.segment).join('')
}

export function truncatePost(text: string, maxGraphemes: number): string {
  if (graphemeLength(text) <= maxGraphemes) return text

  // Check if text ends with a URL
  const match = text.match(URL_REGEX)
  if (match) {
    const url = match[0]
    const prefix = text.slice(0, text.length - url.length).trimEnd()
    const urlGraphemes = graphemeLength(url)
    // Budget: [truncated prefix] + "…" (1) + " " (1) + [url]
    const prefixBudget = maxGraphemes - urlGraphemes - 2
    if (prefixBudget > 0) {
      return sliceGraphemes(prefix, prefixBudget) + '… ' + url
    }
  }

  // No trailing URL or URL too long: simple end truncation
  return sliceGraphemes(text, maxGraphemes - 1) + '…'
}
