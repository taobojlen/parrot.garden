<template>
  <div class="mx-auto max-w-lg">
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UButton to="/dashboard" variant="ghost" color="neutral" icon="i-lucide-arrow-left" size="sm" />
          <h1 class="text-2xl font-bold">Create Connection</h1>
        </div>
      </template>
      <UForm :state="form" @submit="handleSubmit">
        <div class="space-y-4">
          <UFormField label="Source" name="sourceId" required>
            <USelect v-model="form.sourceId" :items="sourceOptions" value-key="value" placeholder="Select a source" required class="w-full" />
          </UFormField>
          <UFormField label="Target" name="targetId" required>
            <USelect v-model="form.targetId" :items="targetOptions" value-key="value" placeholder="Select a target" required class="w-full" />
          </UFormField>
          <USeparator />
          <UFormField label="Template" name="template">
            <template #default>
              <UTextarea ref="templateRef" v-model="form.template" :rows="3" placeholder="{{title}} {{link}}" class="w-full" />
              <TemplateVariables @insert="insertVariable" class="mt-2" />
            </template>
          </UFormField>
          <UFormField label="Images" name="includeImages">
            <UCheckbox v-model="form.includeImages" label="Include images" :description="imageDescription" />
          </UFormField>
          <UFormField label="Truncation" name="truncateWithLink">
            <UCheckbox v-model="form.truncateWithLink" label="Truncate and add source link if post is too long" :disabled="templateHasLink" />
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

    <TemplatePreview :source-id="form.sourceId" :template="form.template" :max-characters="selectedTarget?.maxCharacters ?? 300" :include-images="form.includeImages" :truncate-with-link="form.truncateWithLink" @image-stats="imageStats = $event" />
  </div>
</template>

<script setup lang="ts">
const { data: sources } = await useFetch('/api/sources')
const { data: targets } = await useFetch('/api/targets')

const sourceOptions = computed(() => (sources.value || []).map((s: any) => ({ label: s.name, value: s.id })))
const targetOptions = computed(() => (targets.value || []).map((t: any) => ({ label: `${t.name} (${t.type})`, value: t.id })))

const selectedTarget = computed(() => (targets.value || []).find((t: any) => t.id === form.targetId))

const DEFAULT_TEMPLATES: Record<string, string> = { bluesky: '{{title}} {{link}}' }

const imageStats = ref({ total: 0, withImages: 0 })
const imageDescription = computed(() => {
  if (imageStats.value.withImages > 0) {
    return `Attach images from feed items to posts (${imageStats.value.withImages} of ${imageStats.value.total} recent items have images)`
  }
  return 'Attach images from feed items to posts'
})
const route = useRoute()
const form = reactive({ sourceId: (route.query.sourceId as string) || '', targetId: (route.query.targetId as string) || '', template: '{{title}} {{link}}', includeImages: true, truncateWithLink: false })
const templateHasLink = computed(() => form.template.includes('{{link}}'))

watch(templateHasLink, (hasLink) => {
  if (hasLink) form.truncateWithLink = false
})
const templateRef = ref()

function insertVariable(variable: string) {
  const el = templateRef.value?.$el?.querySelector('textarea') as HTMLTextAreaElement | undefined
  if (!el) {
    form.template += variable
    return
  }
  const start = el.selectionStart
  const end = el.selectionEnd
  form.template = form.template.slice(0, start) + variable + form.template.slice(end)
  nextTick(() => {
    const pos = start + variable.length
    el.focus()
    el.setSelectionRange(pos, pos)
  })
}

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
