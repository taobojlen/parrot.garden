<template>
  <div class="mx-auto max-w-lg">
    <div class="flex items-center gap-2 mb-6">
      <UButton to="/dashboard" variant="ghost" color="neutral" icon="i-lucide-arrow-left" size="sm" />
      <h1 class="text-2xl font-bold text-(--ui-text-highlighted)">Edit Connection</h1>
    </div>
    <UCard>
      <UForm :state="form" @submit="handleSubmit">
        <div class="space-y-4">
          <UFormField label="Source" name="source">
            <UInput :model-value="connection?.sourceName" disabled icon="i-lucide-rss" />
          </UFormField>
          <UFormField label="Target" name="target">
            <UInput :model-value="connection ? `${connection.targetName} (${connection.targetType})` : ''" disabled icon="i-lucide-share-2" />
          </UFormField>
          <USeparator />
          <UFormField label="Template" name="template" hint="Variables: {{title}}, {{link}}, {{description}}, {{author}}, {{date}}">
            <UTextarea v-model="form.template" :rows="3" />
          </UFormField>
          <UFormField label="Status" name="enabled">
            <USwitch v-model="form.enabled" label="Active" :description="form.enabled ? 'Connection is active and will cross-post new items' : 'Connection is paused'" />
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

const { data: connection } = await useFetch(`/api/connections/${id}`)

const form = reactive({
  template: connection.value?.template ?? '{{title}} {{link}}',
  enabled: connection.value?.enabled ?? true,
})

const saving = ref(false)
const deleting = ref(false)
const error = ref('')

async function handleSubmit() {
  saving.value = true
  error.value = ''
  try {
    await $fetch(`/api/connections/${id}`, { method: 'PUT', body: form })
    navigateTo('/dashboard')
  } catch (e: any) {
    error.value = e.data?.statusMessage || 'Failed to save connection'
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (!confirm('Delete this connection?')) return
  deleting.value = true
  error.value = ''
  try {
    await $fetch(`/api/connections/${id}`, { method: 'DELETE' })
    navigateTo('/dashboard')
  } catch (e: any) {
    error.value = e.data?.statusMessage || 'Failed to delete connection'
  } finally {
    deleting.value = false
  }
}
</script>
