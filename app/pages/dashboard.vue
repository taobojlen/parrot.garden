<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-(--ui-text-highlighted)">Dashboard</h1>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- Sources -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-rss" class="text-(--ui-primary)" />
              <h2 class="font-semibold">Sources</h2>
            </div>
            <UButton to="/sources/new" size="xs" icon="i-lucide-plus" variant="soft">
              Add
            </UButton>
          </div>
        </template>
        <div v-if="sources?.length" class="space-y-1">
          <UButton
            v-for="source in sources"
            :key="source.id"
            :to="`/sources/${source.id}`"
            variant="ghost"
            color="neutral"
            block
            class="justify-start"
          >
            <div class="flex flex-col items-start gap-0.5 min-w-0">
              <span class="font-medium text-sm">{{ source.name }}</span>
              <span class="text-xs text-(--ui-text-muted) truncate max-w-full">{{ source.url }}</span>
            </div>
          </UButton>
        </div>
        <div v-else class="text-center py-4">
          <p class="text-sm text-(--ui-text-dimmed)">No sources yet</p>
        </div>
      </UCard>

      <!-- Targets -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-share-2" class="text-(--ui-primary)" />
              <h2 class="font-semibold">Targets</h2>
            </div>
            <UButton to="/targets/new" size="xs" icon="i-lucide-plus" variant="soft">
              Add
            </UButton>
          </div>
        </template>
        <div v-if="targets?.length" class="space-y-1">
          <UButton
            v-for="target in targets"
            :key="target.id"
            :to="`/targets/${target.id}`"
            variant="ghost"
            color="neutral"
            block
            class="justify-start"
          >
            <div class="flex items-center gap-2 min-w-0">
              <span class="font-medium text-sm">{{ target.name }}</span>
              <UBadge variant="subtle" size="xs" color="neutral">{{ target.type }}</UBadge>
            </div>
          </UButton>
        </div>
        <div v-else class="text-center py-4">
          <p class="text-sm text-(--ui-text-dimmed)">No targets yet</p>
        </div>
      </UCard>

      <!-- Connections -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-link" class="text-(--ui-primary)" />
              <h2 class="font-semibold">Connections</h2>
            </div>
            <UButton to="/connections/new" size="xs" icon="i-lucide-plus" variant="soft">
              Add
            </UButton>
          </div>
        </template>
        <div v-if="connections?.length" class="space-y-1">
          <UButton
            v-for="conn in connections"
            :key="conn.id"
            :to="`/connections/${conn.id}`"
            variant="ghost"
            color="neutral"
            block
            class="justify-start"
          >
            <div class="flex items-center gap-2 min-w-0">
              <span class="font-medium text-sm">{{ conn.sourceName }} &rarr; {{ conn.targetName }}</span>
              <UBadge
                :color="conn.enabled ? 'success' : 'neutral'"
                variant="subtle"
                size="xs"
              >
                {{ conn.enabled ? 'Active' : 'Paused' }}
              </UBadge>
            </div>
          </UButton>
        </div>
        <div v-else class="text-center py-4">
          <p class="text-sm text-(--ui-text-dimmed)">No connections yet</p>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
const { data: sources } = useFetch('/api/sources')
const { data: targets } = useFetch('/api/targets')
const { data: connections } = useFetch('/api/connections')
</script>
