<template>
  <div class="mx-auto max-w-lg">
    <div class="flex items-center gap-2 mb-6">
      <UButton to="/dashboard" variant="ghost" color="neutral" icon="i-lucide-arrow-left" size="sm" />
      <h1 class="text-2xl font-bold ">Edit Target</h1>
    </div>
    <UCard>
      <UForm :state="formState" @submit="handleSubmit">
        <div class="space-y-4">
          <UFormField label="Name" name="name" required>
            <UInput v-model="form.name" placeholder="My Bluesky" icon="i-lucide-type" required class="w-full" />
          </UFormField>
          <UFormField label="Type" name="type">
            <USelect v-model="form.type" :items="targetTypes" value-key="value" disabled class="w-full" />
          </UFormField>
          <template v-if="form.type === 'bluesky'">
            <USeparator label="Update Credentials" />
            <UFormField label="Handle" name="handle" hint="Leave blank to keep existing credentials">
              <UInput v-model="credentials.handle" placeholder="Enter new handle to update" icon="i-lucide-at-sign" class="w-full" />
            </UFormField>
            <UFormField label="App Password" name="appPassword" hint="Leave blank to keep existing credentials">
              <UInput v-model="credentials.appPassword" type="password" placeholder="Enter new app password to update" icon="i-lucide-key-round" class="w-full" />
            </UFormField>
          </template>
          <template v-if="form.type === 'mastodon'">
            <USeparator />
            <UFormField label="Instance">
              <p class="text-sm text-neutral-500">{{ target?.instanceUrl }}</p>
            </UFormField>
            <p class="text-xs text-neutral-400">Credentials are managed via OAuth. Delete and re-create the target to re-authorize.</p>
          </template>
        </div>
        <div class="flex items-center gap-2 mt-6">
          <UButton type="submit" :loading="saving" :icon="saved ? 'i-lucide-check' : undefined">{{ saved ? 'Saved' : 'Save Changes' }}</UButton>
          <UButton to="/dashboard" variant="ghost" color="neutral">Cancel</UButton>
          <div class="flex-1" />
          <UButton
            color="error"
            variant="soft"
            :loading="deleting"
            icon="i-lucide-trash-2"
            @click="deleteOpen = true"
          >
            Delete
          </UButton>
        </div>
      </UForm>
      <ConfirmModal
        v-model:open="deleteOpen"
        title="Delete target"
        message="Delete this target? All associated connections will also be removed."
        confirm-label="Delete"
        :loading="deleting"
        @confirm="handleDelete"
      />
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="error"
        class="mt-4"
      />
    </UCard>
    <UCard class="mt-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="font-medium text-sm">Create a connection</p>
          <p class="text-xs text-neutral-400">Connect an RSS source to post to this target</p>
        </div>
        <UButton :to="`/connections/new?targetId=${id}`" icon="i-lucide-plus" variant="soft" size="sm">
          New Connection
        </UButton>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const id = route.params.id as string

const targetTypes = [
  { label: 'Bluesky', value: 'bluesky' },
  { label: 'Mastodon', value: 'mastodon' },
]

const { data: target } = await useFetch(`/api/targets/${id}`)

const form = reactive({
  name: target.value?.name ?? '',
  type: target.value?.type ?? 'bluesky',
})

// Credentials are never returned by the API; only send if the user fills them in
const credentials = reactive({ handle: '', appPassword: '' })

const formState = computed(() => ({ ...form, ...credentials }))

const saving = ref(false)
const saved = ref(false)
const deleting = ref(false)
const deleteOpen = ref(false)
const error = ref('')

watch(() => ({ ...form, ...credentials }), () => { saved.value = false })

async function handleSubmit() {
  saving.value = true
  error.value = ''
  try {
    const body: Record<string, unknown> = { name: form.name }
    // Only include credentials for bluesky if both fields have been filled in
    if (form.type === 'bluesky' && credentials.handle && credentials.appPassword) {
      body.credentials = { handle: credentials.handle, appPassword: credentials.appPassword }
    }
    await $fetch(`/api/targets/${id}`, { method: 'PUT', body })
    saved.value = true
    credentials.handle = ''
    credentials.appPassword = ''
  } catch (e: any) {
    error.value = e.data?.statusMessage || 'Failed to save target'
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
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
