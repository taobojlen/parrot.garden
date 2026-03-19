<template>
  <div class="mx-auto max-w-lg">
    <div class="flex items-center gap-2 mb-6">
      <UButton to="/dashboard" variant="ghost" color="neutral" icon="i-lucide-arrow-left" size="sm" />
      <h1 class="text-2xl font-bold text-(--ui-text-highlighted)">Edit Target</h1>
    </div>
    <UCard>
      <UForm :state="formState" @submit="handleSubmit">
        <div class="space-y-4">
          <UFormField label="Name" name="name" required>
            <UInput v-model="form.name" placeholder="My Bluesky" icon="i-lucide-type" required />
          </UFormField>
          <UFormField label="Type" name="type" required>
            <USelect v-model="form.type" :items="targetTypes" value-key="value" required />
          </UFormField>
          <template v-if="form.type === 'bluesky'">
            <USeparator label="Update Credentials" />
            <UFormField label="Handle" name="handle" hint="Leave blank to keep existing credentials">
              <UInput v-model="credentials.handle" placeholder="Enter new handle to update" icon="i-lucide-at-sign" />
            </UFormField>
            <UFormField label="App Password" name="appPassword" hint="Leave blank to keep existing credentials">
              <UInput v-model="credentials.appPassword" type="password" placeholder="Enter new app password to update" icon="i-lucide-key-round" />
            </UFormField>
          </template>
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

const targetTypes = [{ label: 'Bluesky', value: 'bluesky' }]

const { data: target } = await useFetch(`/api/targets/${id}`)

const form = reactive({
  name: target.value?.name ?? '',
  type: target.value?.type ?? 'bluesky',
})

// Credentials are never returned by the API; only send if the user fills them in
const credentials = reactive({ handle: '', appPassword: '' })

const formState = computed(() => ({ ...form, ...credentials }))

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
