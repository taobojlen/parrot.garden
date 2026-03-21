const URL_REGEX_TRAILING = /https?:\/\/[^\s]+$/
const URL_REGEX_GLOBAL = /https?:\/\/[^\s]+/g
const segmenter = new Intl.Segmenter()

interface TruncateOptions {
  urlCost?: number
}

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

export function truncatePost(text: string, maxGraphemes: number, options?: TruncateOptions): string {
  if (options?.urlCost !== undefined) {
    return truncateWithUrlCost(text, maxGraphemes, options.urlCost)
  }

  if (graphemeLength(text) <= maxGraphemes) return text

  // Check if text ends with a URL
  const match = text.match(URL_REGEX_TRAILING)
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

function truncateWithUrlCost(text: string, maxGraphemes: number, urlCost: number): string {
  // Split text into alternating non-URL and URL parts
  const parts: { text: string; isUrl: boolean }[] = []
  let lastIndex = 0
  URL_REGEX_GLOBAL.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = URL_REGEX_GLOBAL.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), isUrl: false })
    }
    parts.push({ text: match[0], isUrl: true })
    lastIndex = URL_REGEX_GLOBAL.lastIndex
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isUrl: false })
  }

  // Calculate effective length
  let effectiveLength = 0
  for (const part of parts) {
    effectiveLength += part.isUrl ? urlCost : graphemeLength(part.text)
  }

  if (effectiveLength <= maxGraphemes) return text

  // Need to truncate non-URL content while preserving all URLs
  const urlCount = parts.filter(p => p.isUrl).length
  const nonUrlBudget = maxGraphemes - (urlCost * urlCount) - 1 // -1 for ellipsis
  let nonUrlUsed = 0
  let result = ''
  let truncated = false

  for (const part of parts) {
    if (part.isUrl) {
      result += part.text
    } else {
      const partLength = graphemeLength(part.text)
      const remaining = nonUrlBudget - nonUrlUsed
      if (!truncated && partLength <= remaining) {
        result += part.text
        nonUrlUsed += partLength
      } else if (!truncated && remaining > 0) {
        result += sliceGraphemes(part.text, remaining) + '…'
        nonUrlUsed += remaining
        truncated = true
      } else if (!truncated) {
        result += '…'
        truncated = true
      }
    }
  }

  return result
}
