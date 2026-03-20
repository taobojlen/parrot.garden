<template>
  <div class="mx-auto max-w-lg">
    <div class="flex items-center gap-2 mb-6">
      <UButton to="/dashboard" variant="ghost" color="neutral" icon="i-lucide-arrow-left" size="sm" />
      <h1 class="text-2xl font-bold ">Edit Connection</h1>
    </div>
    <UCard>
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
            <UCheckbox v-model="form.includeImages" label="Include images" description="Attach images from feed items to posts" />
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

    <TemplatePreview :source-id="connection?.sourceId ?? ''" :template="form.template" :include-images="form.includeImages" :connection-id="id" />

    <!-- Test Post -->
    <UCard class="mt-6">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-send" class="text-primary" />
          <h2 class="font-semibold">Test Post</h2>
        </div>
      </template>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
        Post the most recent feed item to test your connection and template.
      </p>
      <UButton
        icon="i-lucide-send"
        :loading="testing"
        variant="soft"
        @click="handleTest"
      >
        Send test post
      </UButton>
      <UAlert
        v-if="testResult"
        color="success"
        variant="subtle"
        icon="i-lucide-check"
        title="Posted successfully"
        :description="testResult"
        class="mt-4"
      />
      <UAlert
        v-if="testError"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="testError"
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
  includeImages: connection.value?.includeImages ?? false,
  enabled: connection.value?.enabled ?? true,
})

const saving = ref(false)
const deleting = ref(false)
const testing = ref(false)
const error = ref('')
const testResult = ref('')
const testError = ref('')

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

async function handleTest() {
  testing.value = true
  testResult.value = ''
  testError.value = ''
  try {
    const res = await $fetch<{ text: string }>(`/api/connections/${id}/test`, { method: 'POST' })
    testResult.value = res.text
  } catch (e: any) {
    testError.value = e.data?.statusMessage || 'Test post failed'
  } finally {
    testing.value = false
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
