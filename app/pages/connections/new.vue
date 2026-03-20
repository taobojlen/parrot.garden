<template>
  <div class="mx-auto max-w-lg">
    <div class="flex items-center gap-2 mb-6">
      <UButton to="/dashboard" variant="ghost" color="neutral" icon="i-lucide-arrow-left" size="sm" />
      <h1 class="text-2xl font-bold">Create Connection</h1>
    </div>
    <UCard>
      <UForm :state="form" @submit="handleSubmit">
        <div class="space-y-4">
          <UFormField label="Source" name="sourceId" required>
            <USelect v-model="form.sourceId" :items="sourceOptions" value-key="value" placeholder="Select a source" required class="w-full" />
          </UFormField>
          <UFormField label="Target" name="targetId" required>
            <USelect v-model="form.targetId" :items="targetOptions" value-key="value" placeholder="Select a target" required class="w-full" />
          </UFormField>
          <USeparator />
          <UFormField label="Template" name="template" hint="Variables: {{title}}, {{link}}, {{description}}, {{content}}, {{author}}, {{date}}">
            <UTextarea v-model="form.template" :rows="3" placeholder="{{title}} {{link}}" class="w-full" />
          </UFormField>
          <UFormField label="Images" name="includeImages">
            <UCheckbox v-model="form.includeImages" label="Include images" description="Attach images from feed items to posts" />
          </UFormField>
        </div>
        <div class="flex items-center gap-2 mt-6">
          <UButton type="submit" :loading="loading">Create Connection</UButton>
          <UButton to="/dashboard" variant="ghost" color="neutral">Cancel</UButton>
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

    <TemplatePreview :source-id="form.sourceId" :template="form.template" :include-images="form.includeImages" />
  </div>
</template>

<script setup lang="ts">
const { data: sources } = await useFetch('/api/sources')
const { data: targets } = await useFetch('/api/targets')

const sourceOptions = computed(() => (sources.value || []).map(s => ({ label: s.name, value: s.id })))
const targetOptions = computed(() => (targets.value || []).map(t => ({ label: `${t.name} (${t.type})`, value: t.id })))

const selectedTarget = computed(() => (targets.value || []).find(t => t.id === form.targetId))

const DEFAULT_TEMPLATES: Record<string, string> = { bluesky: '{{title}} {{link}}' }

const form = reactive({ sourceId: '', targetId: '', template: '{{title}} {{link}}', includeImages: false })

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
    const created = await $fetch('/api/connections', { method: 'POST', body: form })
    navigateTo(`/connections/${created.id}`)
  } catch (e: any) {
    error.value = e.data?.statusMessage || 'Failed to create connection'
  } finally {
    loading.value = false
  }
}
</script>
