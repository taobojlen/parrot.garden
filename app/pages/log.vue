<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Post Log</h1>
      <UButton variant="ghost" color="neutral" icon="i-lucide-refresh-cw" @click="() => refresh()">
        Refresh
      </UButton>
    </div>
    <UCard>
      <UTable
        v-if="logs?.length"
        :data="logs"
        :columns="columns"
        :loading="status === 'pending'"
      >
        <template #status-cell="{ row }">
          <UBadge
            :color="row.original.status === 'posted' ? 'success' : row.original.status === 'failed' ? 'error' : 'neutral'"
            variant="subtle"
            size="sm"
          >
            {{ row.original.status }}
          </UBadge>
        </template>
        <template #error-cell="{ row }">
          <span v-if="row.original.error" class="text-sm text-neutral-500 truncate max-w-48 block">
            {{ row.original.error }}
          </span>
          <span v-else class="text-sm text-neutral-400">&mdash;</span>
        </template>
        <template #actions-cell="{ row }">
          <UButton
            v-if="row.original.status === 'failed'"
            size="xs"
            variant="soft"
            color="warning"
            icon="i-lucide-rotate-ccw"
            :loading="retrying === row.original.id"
            @click="retry(row.original.id as string)"
          >
            Retry
          </UButton>
        </template>
      </UTable>
      <p v-else class="text-sm text-neutral-400 dark:text-neutral-500 text-center py-4">No posts yet</p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const { data: logs, refresh, status } = useFetch('/api/post-log')
const retrying = ref('')

const columns = [
  { accessorKey: 'itemTitle', header: 'Title' },
  { accessorKey: 'sourceName', header: 'Source' },
  { accessorKey: 'targetName', header: 'Target' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'error', header: 'Error' },
  { accessorKey: 'actions', header: '' },
]

async function retry(id: string) {
  retrying.value = id
  try {
    await $fetch(`/api/post-log/${id}/retry`, { method: 'POST' })
    await refresh()
  } catch (e) {
    await refresh()
  } finally {
    retrying.value = ''
  }
}
</script>
