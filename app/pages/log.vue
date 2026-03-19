<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Post Log</h1>
    <UCard>
      <UTable :data="logs || []" :columns="columns">
        <template #status-cell="{ row }">
          <UBadge
            :color="row.original.status === 'posted' ? 'success' : row.original.status === 'failed' ? 'error' : 'neutral'"
            variant="subtle">
            {{ row.original.status }}
          </UBadge>
        </template>
        <template #actions-cell="{ row }">
          <UButton v-if="row.original.status === 'failed'" size="xs" variant="ghost"
            :loading="retrying === row.original.id" @click="retry(row.original.id)">
            Retry
          </UButton>
        </template>
      </UTable>
      <p v-if="!logs?.length" class="text-gray-500 text-center py-4">No posts yet</p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const { data: logs, refresh } = useFetch('/api/post-log')
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
