export const D1_MAX_PARAMS = 100
export const POST_LOG_COLUMNS = 14
export const D1_BATCH_SIZE = Math.floor(D1_MAX_PARAMS / POST_LOG_COLUMNS) // 7
export const SOURCE_ITEM_COLUMNS = 4
export const SOURCE_ITEM_BATCH_SIZE = Math.floor(D1_MAX_PARAMS / SOURCE_ITEM_COLUMNS) // 25

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}
