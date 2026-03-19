<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Dashboard</h1>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- Sources -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">Sources</h2>
            <NuxtLink to="/sources/new">
              <UButton size="xs" icon="i-lucide-plus">Add</UButton>
            </NuxtLink>
          </div>
        </template>
        <div v-if="sources?.length" class="space-y-2">
          <NuxtLink v-for="source in sources" :key="source.id" :to="`/sources/${source.id}`"
            class="block p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
            <p class="font-medium">{{ source.name }}</p>
            <p class="text-sm text-gray-500 truncate">{{ source.url }}</p>
          </NuxtLink>
        </div>
        <p v-else class="text-gray-500">No sources yet</p>
      </UCard>

      <!-- Targets -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">Targets</h2>
            <NuxtLink to="/targets/new">
              <UButton size="xs" icon="i-lucide-plus">Add</UButton>
            </NuxtLink>
          </div>
        </template>
        <div v-if="targets?.length" class="space-y-2">
          <NuxtLink v-for="target in targets" :key="target.id" :to="`/targets/${target.id}`"
            class="block p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
            <p class="font-medium">{{ target.name }}</p>
            <UBadge variant="subtle" size="xs">{{ target.type }}</UBadge>
          </NuxtLink>
        </div>
        <p v-else class="text-gray-500">No targets yet</p>
      </UCard>

      <!-- Connections -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">Connections</h2>
            <NuxtLink to="/connections/new">
              <UButton size="xs" icon="i-lucide-plus">Add</UButton>
            </NuxtLink>
          </div>
        </template>
        <div v-if="connections?.length" class="space-y-2">
          <NuxtLink v-for="conn in connections" :key="conn.id" :to="`/connections/${conn.id}`"
            class="block p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
            <p class="font-medium">{{ conn.sourceName }} → {{ conn.targetName }}</p>
            <UBadge :color="conn.enabled ? 'success' : 'neutral'" variant="subtle" size="xs">
              {{ conn.enabled ? 'Active' : 'Paused' }}
            </UBadge>
          </NuxtLink>
        </div>
        <p v-else class="text-gray-500">No connections yet</p>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
const { data: sources } = useFetch('/api/sources')
const { data: targets } = useFetch('/api/targets')
const { data: connections } = useFetch('/api/connections')
</script>
