<template>
  <div class="mx-auto max-w-lg">
    <h1 class="text-2xl font-bold mb-6">Edit Target</h1>
    <UCard>
      <form @submit.prevent="handleSubmit">
        <div class="space-y-4">
          <UFormField label="Name">
            <UInput v-model="form.name" placeholder="My Bluesky" required />
          </UFormField>
          <UFormField label="Type">
            <USelect v-model="form.type" :items="targetTypes" required />
          </UFormField>
          <template v-if="form.type === 'bluesky'">
            <UFormField label="Handle" hint="Leave blank to keep existing credentials">
              <UInput v-model="credentials.handle" placeholder="Enter new handle to update" />
            </UFormField>
            <UFormField label="App Password" hint="Leave blank to keep existing credentials">
              <UInput v-model="credentials.appPassword" type="password" placeholder="Enter new app password to update" />
            </UFormField>
          </template>
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

const targetTypes = [{ label: 'Bluesky', value: 'bluesky' }]

const { data: target } = await useFetch(`/api/targets/${id}`)

const form = reactive({
  name: target.value?.name ?? '',
  type: target.value?.type ?? 'bluesky',
})

// Credentials are never returned by the API; only send if the user fills them in
const credentials = reactive({ handle: '', appPassword: '' })

const saving = ref(false)
const deleting = ref(false)
const error = ref('')

async function handleSubmit() {
  saving.value = true
  error.value = ''
  try {
    const body: Record<string, unknown> = { ...form }
    // Only include credentials if both fields have been filled in
    if (credentials.handle && credentials.appPassword) {
      body.credentials = { handle: credentials.handle, appPassword: credentials.appPassword }
    }
    await $fetch(`/api/targets/${id}`, { method: 'PUT', body })
    navigateTo('/dashboard')
  } catch (e: any) {
    error.value = e.data?.statusMessage || 'Failed to save target'
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (!confirm('Delete this target? All associated connections will also be removed.')) return
  deleting.value = true
  error.value = ''
  try {
    await $fetch(`/api/targets/${id}`, { method: 'DELETE' })
    navigateTo('/dashboard')
  } catch (e: any) {
    error.value = e.data?.statusMessage || 'Failed to delete target'
  } finally {
    deleting.value = false
  }
}
</script>
