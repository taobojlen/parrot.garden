import { eq, getTableColumns, sql } from 'drizzle-orm'
import type { InferInsertModel } from 'drizzle-orm'
import type { targets } from '../db/schema';
import { sources } from '../db/schema'

const RESOURCE_LIMIT = 10
type ResourceTable = typeof sources | typeof targets

function limitError(table: ResourceTable) {
  return createError({
    statusCode: 409,
    statusMessage: `You can have up to ${RESOURCE_LIMIT} ${table === sources ? 'feeds' : 'destinations'}. Delete one before adding another.`,
  })
}

export async function checkResourceLimit(table: ResourceTable, userId: string) {
  const [result] = await db.select({ count: sql<number>`count(*)` })
    .from(table).where(eq(table.userId, userId))
  if (result!.count >= RESOURCE_LIMIT) throw limitError(table)
}

export async function insertLimitedResource(table: ResourceTable, resource: InferInsertModel<ResourceTable>) {
  const values = Object.entries(getTableColumns(table)).map(([key, column]) =>
    sql`${sql.param((resource as Record<string, unknown>)[key], column)}`,
  )

  // Count and insert in one statement so concurrent requests cannot exceed the limit.
  const inserted = await db.insert(table).select(sql`
    select ${sql.join(values, sql`, `)}
    where (select count(*) from ${table} where ${table.userId} = ${resource.userId}) < ${RESOURCE_LIMIT}
  `).returning({ id: table.id })

  if (!inserted.length) throw limitError(table)
}
