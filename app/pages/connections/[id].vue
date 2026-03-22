<template>
  <div class="mx-auto max-w-lg">
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UButton to="/dashboard" variant="ghost" color="neutral" icon="i-lucide-arrow-left" size="sm" />
          <h1 class="text-2xl font-bold">Edit Connection</h1>
        </div>
      </template>
      <UForm :state="form" @submit="handleSubmit">
        <div class="space-y-4">
          <UFormField label="Source" name="source">
            <UInput :model-value="connection?.sourceName" disabled icon="i-lucide-rss" class="w-full" />
          </UFormField>
          <UFormField label="Target" name="target">
            <UInput :model-value="connection ? `${connection.targetName} (${connection.targetType})` : ''" disabled icon="i-lucide-share-2" class="w-full" />
          </UFormField>
          <USeparator />
          <UFormField label="Template" name="template" hint="Variables: {{title}}, {{link}}, {{description}}, {{content}}, {{author}}, {{date}}">
            <UTextarea v-model="form.template" :rows="3" class="w-full" />
          </UFormField>
          <UFormField label="Images" name="includeImages">
            <UCheckbox v-model="form.includeImages" label="Include images" :description="imageDescription" />
          </UFormField>
          <UFormField label="Status" name="enabled">
            <USwitch v-model="form.enabled" label="Active" :description="form.enabled ? 'Connection is active and will cross-post new items' : 'Connection is paused'" />
          </UFormField>
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
        title="Delete connection"
        message="Delete this connection?"
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

    <TemplatePreview :source-id="connection?.sourceId ?? ''" :template="form.template" :include-images="form.includeImages" :connection-id="id" :has-unsaved-changes="hasUnsavedChanges" @image-stats="imageStats = $event" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const id = route.params.id as string

const { data: connection } = await useFetch(`/api/connections/${id}`)

const form = reactive({
  template: connection.value?.template ?? '{{title}} {{link}}',
  includeImages: connection.value?.includeImages ?? false,
  enabled: connection.value?.enabled ?? true,
})

const imageStats = ref({ total: 0, withImages: 0 })
const imageDescription = computed(() => {
  if (imageStats.value.withImages > 0) {
    return `Attach images from feed items to posts (${imageStats.value.withImages} of ${imageStats.value.total} recent items have images)`
  }
  return 'Attach images from feed items to posts'
})
const saving = ref(false)
const saved = ref(false)
const deleting = ref(false)
const deleteOpen = ref(false)
const error = ref('')

const savedForm = ref({ ...form })
const hasUnsavedChanges = computed(() =>
  form.template !== savedForm.value.template
  || form.includeImages !== savedForm.value.includeImages
  || form.enabled !== savedForm.value.enabled,
)

watch(() => ({ ...form }), () => { saved.value = false })

async function handleSubmit() {
  saving.value = true
  error.value = ''
  try {
    await $fetch(`/api/connections/${id}`, { method: 'PUT', body: form })
    savedForm.value = { ...form }
    saved.value = true
  } catch (e: any) {
    error.value = e.data?.statusMessage || 'Failed to save connection'
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
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
