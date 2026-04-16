import { describe, it, expect } from 'vitest'
import { chunk, D1_BATCH_SIZE } from '../../server/utils/batch'

describe('chunk', () => {
  it('returns empty array for empty input', () => {
    expect(chunk([], 7)).toEqual([])
  })

  it('returns single chunk when items fit within size', () => {
    expect(chunk([1, 2, 3], 7)).toEqual([[1, 2, 3]])
  })

  it('splits items into chunks of given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('handles exact multiples', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]])
  })

  it('D1_BATCH_SIZE is 6 for 16-column post_log table', () => {
    expect(D1_BATCH_SIZE).toBe(6)
  })

  it('splits 13 items into batches that stay under 100 params with 16 columns', () => {
    const items = Array.from({ length: 13 }, (_, i) => i)
    const batches = chunk(items, D1_BATCH_SIZE)
    expect(batches).toHaveLength(3)
    expect(batches[0]).toHaveLength(6)
    expect(batches[1]).toHaveLength(6)
    expect(batches[2]).toHaveLength(1)
    // Each batch * 16 columns stays under 100
    for (const batch of batches) {
      expect(batch.length * 16).toBeLessThanOrEqual(100)
    }
  })
})
