<template>
  <div class="mx-auto max-w-lg">
    <h1 class="text-2xl font-bold mb-6">Edit Connection</h1>
    <UCard>
      <form @submit.prevent="handleSubmit">
        <div class="space-y-4">
          <UFormField label="Source">
            <UInput :value="connection?.sourceName" disabled />
          </UFormField>
          <UFormField label="Target">
            <UInput :value="connection ? `${connection.targetName} (${connection.targetType})` : ''" disabled />
          </UFormField>
          <UFormField label="Template" hint="Variables: {{title}}, {{link}}, {{description}}, {{author}}, {{date}}">
            <UTextarea v-model="form.template" :rows="3" />
          </UFormField>
          <UFormField label="Status">
            <div class="flex items-center gap-3">
              <UToggle v-model="form.enabled" />
              <span class="text-sm">{{ form.enabled ? 'Active' : 'Paused' }}</span>
            </div>
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
