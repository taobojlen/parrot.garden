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

  it('splits 13 items into batches that stay under 100 params with 16 columns', () => {
    const items = Array.from({ length: 13 }, (_, i) => i)
    const batches = chunk(items, D1_BATCH_SIZE)
    expect(batches.flat()).toEqual(items)
    for (const batch of batches) {
      expect(batch.length).toBeGreaterThan(0)
      expect(batch.length * 16).toBeLessThanOrEqual(100)
    }
  })
})
