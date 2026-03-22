import { describe, it, expect } from 'vitest'
import { renderTemplate, truncatePost } from '../../server/utils/template'

describe('renderTemplate', () => {
  it('replaces variables with values', () => {
    const result = renderTemplate('{{title}} {{link}}', {
      title: 'Hello World',
      link: 'https://example.com',
    })
    expect(result).toBe('Hello World https://example.com')
  })

  it('leaves unknown variables as empty string', () => {
    const result = renderTemplate('{{title}} by {{author}}', {
      title: 'Post',
    })
    expect(result).toBe('Post by ')
  })

  it('handles missing variables gracefully', () => {
    const result = renderTemplate('{{title}}', {})
    expect(result).toBe('')
  })
})

describe('renderTemplate + truncatePost integration', () => {
  it('renders title+link template for bluesky without truncating short posts', () => {
    const rendered = renderTemplate('{{title}}\n\n{{link}}', {
      title: 'Announcing: Parrot.garden',
      link: 'https://btao.org/posts/2026-03-22-parrots/',
    })
    const result = truncatePost(rendered, 300)
    expect(result).toBe('Announcing: Parrot.garden\n\nhttps://btao.org/posts/2026-03-22-parrots/')
  })
})

describe('truncatePost', () => {
  it('returns text unchanged if within limit', () => {
    const result = truncatePost('Hello world', 300)
    expect(result).toBe('Hello world')
  })

  it('truncates from end with ellipsis when no trailing URL', () => {
    const text = 'A'.repeat(301)
    const result = truncatePost(text, 300)
    expect(result.length).toBeLessThanOrEqual(300)
    expect(result.endsWith('…')).toBe(true)
  })

  it('truncates text before trailing URL to preserve it', () => {
    const title = 'A'.repeat(290)
    const url = 'https://example.com/very-long-path'
    const text = `${title} ${url}`
    const result = truncatePost(text, 300)
    expect(result.endsWith(url)).toBe(true)
    expect(result.includes('…')).toBe(true)
    expect([...new Intl.Segmenter().segment(result)].length).toBeLessThanOrEqual(300)
  })

  it('truncates from end when URL is in the middle', () => {
    const text = `Check https://example.com for ${'A'.repeat(290)}`
    const result = truncatePost(text, 300)
    expect(result.endsWith('…')).toBe(true)
  })

  it('handles emoji graphemes correctly', () => {
    const emoji = '👨‍👩‍👧‍👦'
    const text = emoji.repeat(301)
    const result = truncatePost(text, 300)
    const graphemeCount = [...new Intl.Segmenter().segment(result)].length
    expect(graphemeCount).toBeLessThanOrEqual(300)
  })

  it('counts URLs at urlCost when option is provided', () => {
    const url = 'https://example.com/very-long-path'
    const text = `Check this out ${url}`
    const result = truncatePost(text, 40, { urlCost: 23 })
    expect(result).toBe(text)
  })

  it('truncates non-URL content when urlCost makes text exceed limit', () => {
    const prefix = 'A'.repeat(280)
    const url = 'https://example.com/path'
    const text = `${prefix} ${url}`
    const result = truncatePost(text, 300, { urlCost: 23 })
    expect(result.endsWith(url)).toBe(true)
    expect(result.includes('…')).toBe(true)
  })

  it('handles multiple URLs with urlCost', () => {
    const url1 = 'https://example.com/first-very-long-url-path'
    const url2 = 'https://example.com/second-very-long-url-path'
    const text = `See ${url1} and ${url2}`
    const result = truncatePost(text, 60, { urlCost: 23 })
    expect(result).toBe(text)
  })

  it('without urlCost, counts URLs at real length (existing behavior)', () => {
    const url = 'https://example.com/very-long-path'
    const text = `Check this out ${url}`
    const result = truncatePost(text, 40)
    expect(result.length).toBeLessThanOrEqual(40)
    expect(result.includes('…')).toBe(true)
  })
})
