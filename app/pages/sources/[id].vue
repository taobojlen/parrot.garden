<template>
  <div class="mx-auto max-w-lg">
    <h1 class="text-2xl font-bold mb-6">Edit Source</h1>
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
          <UButton type="submit" :loading="saving">Save Changes</UButton>
          <NuxtLink to="/dashboard"><UButton variant="ghost">Cancel</UButton></NuxtLink>
          <UButton
            class="ml-auto"
            color="error"
            variant="ghost"
            :loading="deleting"
            @click="handleDelete"
          >
            Delete
          </UButton>
        </div>
        <p v-if="error" class="text-red-500 mt-2 text-sm">{{ error }}</p>
      </form>
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
