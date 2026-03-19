<template>
  <div class="mx-auto max-w-lg">
    <div class="flex items-center gap-2 mb-6">
      <UButton to="/dashboard" variant="ghost" color="neutral" icon="i-lucide-arrow-left" size="sm" />
      <h1 class="text-2xl font-bold ">Edit Source</h1>
    </div>
    <UCard>
      <UForm :state="form" @submit="handleSubmit">
        <div class="space-y-4">
          <UFormField label="Name" name="name" required>
            <UInput v-model="form.name" placeholder="My Blog" icon="i-lucide-type" required class="w-full" />
          </UFormField>
          <UFormField label="Feed URL" name="url" required>
            <UInput v-model="form.url" type="url" placeholder="https://example.com/feed.xml" icon="i-lucide-rss" required class="w-full" />
          </UFormField>
        </div>
        <div class="flex items-center gap-2 mt-6">
          <UButton type="submit" :loading="saving">Save Changes</UButton>
          <UButton to="/dashboard" variant="ghost" color="neutral">Cancel</UButton>
          <div class="flex-1" />
          <UButton
            color="error"
            variant="soft"
            :loading="deleting"
            icon="i-lucide-trash-2"
            @click="handleDelete"
          >
            Delete
          </UButton>
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

    <!-- Recent Feed Items -->
    <UCard class="mt-6">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-rss" class="text-primary" />
          <h2 class="font-semibold">Recent Feed Items</h2>
        </div>
      </template>
      <div v-if="feedItems?.length" class="space-y-2">
        <a
          v-for="(item, i) in feedItems"
          :key="i"
          :href="item.link"
          target="_blank"
          class="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium truncate">{{ item.title || 'Untitled' }}</p>
            <p v-if="item.pubDate" class="text-xs text-neutral-500 dark:text-neutral-400">{{ item.pubDate }}</p>
          </div>
        </a>
      </div>
      <p v-else class="text-sm text-neutral-400 dark:text-neutral-500 text-center py-4">
        No items in feed.
      </p>
    </UCard>

    <!-- Cross-Post Activity -->
    <UCard v-if="posts?.length" class="mt-6">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-scroll-text" class="text-primary" />
          <h2 class="font-semibold">Cross-Post Activity</h2>
        </div>
      </template>
      <div class="space-y-2">
        <div
          v-for="post in posts"
          :key="post.id"
          class="flex items-center justify-between gap-3 p-2 rounded-lg"
        >
          <div class="min-w-0 flex-1">
            <a
              v-if="post.itemLink"
              :href="post.itemLink"
              target="_blank"
              class="text-sm font-medium hover:underline truncate block"
            >
              {{ post.itemTitle || 'Untitled' }}
            </a>
            <p v-else class="text-sm font-medium truncate">{{ post.itemTitle || 'Untitled' }}</p>
            <p class="text-xs text-neutral-500 dark:text-neutral-400">
              → {{ post.targetName }}
            </p>
          </div>
          <UBadge
            :color="post.status === 'posted' ? 'success' : 'error'"
            variant="subtle"
            size="xs"
          >
            {{ post.status }}
          </UBadge>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const id = route.params.id as string

const { data: source } = await useFetch(`/api/sources/${id}`)
const { data: feedItems } = await useFetch(`/api/sources/${id}/items`)
const { data: posts } = await useFetch(`/api/sources/${id}/posts`)

const form = reactive({
  name: source.value?.name ?? '',
  url: source.value?.url ?? '',
})

const saving = ref(false)
const deleting = ref(false)
const error = ref('')

async function handleSubmit() {
  saving.value = true
  error.value = ''
  try {
    await $fetch(`/api/sources/${id}`, { method: 'PUT', body: form })
    navigateTo('/dashboard')
  } catch (e: any) {
    error.value = e.data?.statusMessage || 'Failed to save source'
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (!confirm('Delete this source? All associated connections will also be removed.')) return
  deleting.value = true
  error.value = ''
  try {
    await $fetch(`/api/sources/${id}`, { method: 'DELETE' })
    navigateTo('/dashboard')
  } catch (e: any) {
    error.value = e.data?.statusMessage || 'Failed to delete source'
  } finally {
    deleting.value = false
  }
}
</script>
