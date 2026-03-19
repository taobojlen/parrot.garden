<template>
  <div class="mx-auto max-w-lg">
    <div class="flex items-center gap-2 mb-6">
      <UButton to="/dashboard" variant="ghost" color="neutral" icon="i-lucide-arrow-left" size="sm" />
      <h1 class="text-2xl font-bold text-(--ui-text-highlighted)">Edit Source</h1>
    </div>
    <UCard>
      <UForm :state="form" @submit="handleSubmit">
        <div class="space-y-4">
          <UFormField label="Name" name="name" required>
            <UInput v-model="form.name" placeholder="My Blog" icon="i-lucide-type" required />
          </UFormField>
          <UFormField label="Feed URL" name="url" required>
            <UInput v-model="form.url" type="url" placeholder="https://example.com/feed.xml" icon="i-lucide-rss" required />
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
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const id = route.params.id as string

const { data: source } = await useFetch(`/api/sources/${id}`)

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
