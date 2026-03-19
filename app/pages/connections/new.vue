<template>
  <div class="mx-auto max-w-lg">
    <h1 class="text-2xl font-bold mb-6">Create Connection</h1>
    <UCard>
      <form @submit.prevent="handleSubmit">
        <div class="space-y-4">
          <UFormField label="Source">
            <USelect v-model="form.sourceId" :items="sourceOptions" placeholder="Select a source" required />
          </UFormField>
          <UFormField label="Target">
            <USelect v-model="form.targetId" :items="targetOptions" placeholder="Select a target" required />
          </UFormField>
          <UFormField label="Template" hint="Variables: {{title}}, {{link}}, {{description}}, {{author}}, {{date}}">
            <UTextarea v-model="form.template" :rows="3" />
          </UFormField>
        </div>
        <div class="flex gap-2 mt-6">
          <UButton type="submit" :loading="loading">Create Connection</UButton>
          <NuxtLink to="/dashboard"><UButton variant="ghost">Cancel</UButton></NuxtLink>
        </div>
        <p v-if="error" class="text-red-500 mt-2 text-sm">{{ error }}</p>
      </form>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const { data: sources } = await useFetch('/api/sources')
const { data: targets } = await useFetch('/api/targets')

const sourceOptions = computed(() => (sources.value || []).map(s => ({ label: s.name, value: s.id })))
const targetOptions = computed(() => (targets.value || []).map(t => ({ label: `${t.name} (${t.type})`, value: t.id })))

const selectedTarget = computed(() => (targets.value || []).find(t => t.id === form.targetId))

const DEFAULT_TEMPLATES: Record<string, string> = { bluesky: '{{title}} {{link}}' }

const form = reactive({ sourceId: '', targetId: '', template: '{{title}} {{link}}' })

watch(() => form.targetId, () => {
  if (selectedTarget.value) {
    form.template = DEFAULT_TEMPLATES[selectedTarget.value.type] || '{{title}} {{link}}'
  }
})

const loading = ref(false)
const error = ref('')

async function handleSubmit() {
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/connections', { method: 'POST', body: form })
    navigateTo('/dashboard')
  } catch (e: any) {
    error.value = e.data?.statusMessage || 'Failed to create connection'
  } finally {
    loading.value = false
  }
}
</script>
