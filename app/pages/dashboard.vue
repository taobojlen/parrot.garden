<template>
  <div>
    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-3 gap-6 dashboard-cards">
      <UCard v-for="i in 3" :key="i">
        <template #header>
          <div class="flex items-center gap-2">
            <USkeleton class="h-5 w-5 rounded" />
            <USkeleton class="h-5 w-24" />
          </div>
        </template>
        <div class="space-y-3">
          <USkeleton v-for="j in 2" :key="j" class="h-10 w-full rounded-lg" />
        </div>
      </UCard>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-6 dashboard-cards">
      <!-- Sources -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-rss" class="text-primary" />
              <h2 class="font-semibold">Sources</h2>
            </div>
            <UButton to="/sources/new" size="xs" icon="i-lucide-plus" variant="soft">
              Add
            </UButton>
          </div>
        </template>
        <div v-if="sources?.length" class="space-y-1">
          <NuxtLink
            v-for="source in sources"
            :key="source.id"
            :to="`/sources/${source.id}`"
            class="block p-2 rounded-lg hover:bg-white/10"
          >
            <p class="font-medium text-sm">{{ source.name }}</p>
            <p class="text-xs text-neutral-500 dark:text-neutral-400 truncate">{{ source.url }}</p>
          </NuxtLink>
        </div>
        <p v-else class="text-sm text-neutral-400 dark:text-neutral-500 text-center py-4">No sources yet</p>
      </UCard>

      <!-- Targets -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-share-2" class="text-primary" />
              <h2 class="font-semibold">Targets</h2>
            </div>
            <UButton to="/targets/new" size="xs" icon="i-lucide-plus" variant="soft">
              Add
            </UButton>
          </div>
        </template>
        <div v-if="targets?.length" class="space-y-1">
          <NuxtLink
            v-for="target in targets"
            :key="target.id"
            :to="`/targets/${target.id}`"
            class="block p-2 rounded-lg hover:bg-white/10"
          >
            <div class="flex items-center gap-2">
              <span class="font-medium text-sm">{{ target.name }}</span>
              <UBadge variant="subtle" size="xs" color="neutral">{{ target.type }}</UBadge>
            </div>
          </NuxtLink>
        </div>
        <p v-else class="text-sm text-neutral-400 dark:text-neutral-500 text-center py-4">No targets yet</p>
      </UCard>

      <!-- Connections -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-link" class="text-primary" />
              <h2 class="font-semibold">Connections</h2>
            </div>
            <UButton to="/connections/new" size="xs" icon="i-lucide-plus" variant="soft">
              Add
            </UButton>
          </div>
        </template>
        <div v-if="connections?.length" class="space-y-1">
          <NuxtLink
            v-for="conn in connections"
            :key="conn.id"
            :to="`/connections/${conn.id}`"
            class="block p-2 rounded-lg hover:bg-white/10"
          >
            <div class="flex items-center gap-2">
              <span class="font-medium text-sm">{{ conn.sourceName }} &rarr; {{ conn.targetName }}</span>
              <UBadge :color="conn.enabled ? 'success' : 'neutral'" variant="subtle" size="xs">
                {{ conn.enabled ? 'Active' : 'Paused' }}
              </UBadge>
            </div>
          </NuxtLink>
        </div>
        <p v-else class="text-sm text-neutral-400 dark:text-neutral-500 text-center py-4">No connections yet</p>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
const { data: sources, status: sourcesStatus } = useFetch('/api/sources')
const { data: targets, status: targetsStatus } = useFetch('/api/targets')
const { data: connections, status: connectionsStatus } = useFetch('/api/connections')

const loading = computed(() =>
  sourcesStatus.value === 'pending'
  || targetsStatus.value === 'pending'
  || connectionsStatus.value === 'pending',
)
</script>
