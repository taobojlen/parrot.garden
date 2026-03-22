<template>
  <div class="mx-auto max-w-lg">
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UButton to="/dashboard" variant="ghost" color="neutral" icon="i-lucide-arrow-left" size="sm" />
          <h1 class="text-2xl font-bold">Add RSS Source</h1>
        </div>
      </template>
      <UForm :state="form" @submit="discovered ? handleSubmit() : handleDiscover()">
        <div class="space-y-4">
          <UFormField label="Name" name="name" required>
            <UInput v-model="form.name" placeholder="My Blog" icon="i-lucide-type" required class="w-full" />
          </UFormField>

          <!-- Phase 1: URL input + Find Feed -->
          <template v-if="!discovered">
            <UFormField label="Website or Feed URL" name="url" required>
              <UInput v-model="form.url" type="url" placeholder="https://example.com" icon="i-lucide-rss" required class="w-full" />
            </UFormField>
            <UButton type="submit" :loading="discovering" icon="i-lucide-search">Find Feed</UButton>
          </template>

          <!-- Phase 2a: Single feed found -->
          <template v-else-if="discovered.type === 'feed' || discovered.feeds.length === 1">
            <UFormField label="Feed URL" name="feedUrl">
              <p class="text-sm text-muted">{{ feedUrl }}</p>
            </UFormField>
          </template>

          <!-- Phase 2b: Multiple feeds found -->
          <template v-else>
            <UFormField label="Select a feed" name="feedUrl" required>
              <URadioGroup v-model="feedUrl" :items="feedOptions" />
            </UFormField>
          </template>
        </div>

        <div v-if="discovered" class="flex items-center gap-2 mt-6">
          <UButton type="submit" :loading="loading">Add Source</UButton>
          <UButton to="/dashboard" variant="ghost" color="neutral">Cancel</UButton>
        </div>
      </UForm>
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="error"
        class="mt-4"
      />
    </UCard>
  </div>
</template>

<script setup lang="ts">
const form = reactive({ name: '', url: '' })
const feedUrl = ref('')
const discovered = ref(null)
const discovering = ref(false)
const loading = ref(false)
const error = ref('')

const feedOptions = computed(() =>
  discovered.value?.feeds.map(f => ({
    label: f.title || f.url,
    description: f.title ? f.url : undefined,
    value: f.url,
  })) ?? [],
)

async function handleDiscover() {
  discovering.value = true
  error.value = ''
  try {
    const result = await $fetch('/api/sources/discover', {
      method: 'POST',
      body: { url: form.url },
    })
    discovered.value = result
    if (result.type === 'feed') {
      feedUrl.value = result.url
    } else if (result.feeds.length === 1) {
      feedUrl.value = result.feeds[0].url
    } else {
      feedUrl.value = ''
    }
  } catch (e: any) {
    error.value = e.data?.statusMessage || 'Failed to discover feed'
  } finally {
    discovering.value = false
  }
}

async function handleSubmit() {
  loading.value = true
  error.value = ''
  try {
    const created = await $fetch('/api/sources', {
      method: 'POST',
      body: { name: form.name, url: feedUrl.value },
    })
    navigateTo(`/sources/${created.id}`)
  } catch (e: any) {
    error.value = e.data?.statusMessage || 'Failed to add source'
  } finally {
    loading.value = false
  }
}
</script>
