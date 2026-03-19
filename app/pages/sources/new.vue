<template>
  <div class="mx-auto max-w-lg">
    <div class="flex items-center gap-2 mb-6">
      <UButton to="/dashboard" variant="ghost" color="neutral" icon="i-lucide-arrow-left" size="sm" />
      <h1 class="text-2xl font-bold text-(--ui-text-highlighted)">Add RSS Source</h1>
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
const loading = ref(false)
const error = ref('')

async function handleSubmit() {
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/sources', { method: 'POST', body: form })
    navigateTo('/dashboard')
  } catch (e: any) {
    error.value = e.data?.statusMessage || 'Failed to add source'
  } finally {
    loading.value = false
  }
}
</script>
