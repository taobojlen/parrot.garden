<template>
  <div class="mx-auto max-w-lg">
    <h1 class="text-2xl font-bold mb-6">Add RSS Source</h1>
    <UCard>
      <form @submit.prevent="handleSubmit">
        <div class="space-y-4">
          <UFormField label="Name">
            <UInput v-model="form.name" placeholder="My Blog" required />
          </UFormField>
          <UFormField label="Feed URL">
            <UInput v-model="form.url" type="url" placeholder="https://example.com/feed.xml" required />
          </UFormField>
        </div>
        <div class="flex gap-2 mt-6">
          <UButton type="submit" :loading="loading">Add Source</UButton>
          <NuxtLink to="/dashboard"><UButton variant="ghost">Cancel</UButton></NuxtLink>
        </div>
        <p v-if="error" class="text-red-500 mt-2 text-sm">{{ error }}</p>
      </form>
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
