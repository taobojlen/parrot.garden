<template>
  <UCard v-if="template && sourceId" class="mt-6">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-eye" class="text-primary" />
        <h2 class="font-semibold">Preview</h2>
        <span class="text-sm text-neutral-500 dark:text-neutral-400">How your recent posts would appear</span>
      </div>
    </template>
    <div v-if="loading" class="py-4 text-center text-sm text-neutral-400">
      Loading feed items...
    </div>
    <div v-else-if="previewItems.length" class="space-y-3">
      <div
        v-for="(item, i) in previewItems"
        :key="i"
        class="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 text-sm whitespace-pre-wrap"
      >
        <p>{{ item.rendered }}</p>
        <div v-if="item.images.length" class="flex gap-2 mt-2">
          <img
            v-for="(img, j) in item.images"
            :key="j"
            :src="img.url"
            :alt="img.alt"
            :title="img.alt || undefined"
            class="w-16 h-16 object-cover rounded border border-neutral-200 dark:border-neutral-700"
          />
        </div>
        <div class="flex items-center justify-between mt-3">
          <p v-if="item.truncated" class="text-xs text-warning">
            Truncated ({{ item.graphemes }}/300 graphemes)
          </p>
          <p v-else class="text-xs text-neutral-400">
            {{ item.graphemes }}/300 graphemes
          </p>
          <UTooltip v-if="connectionId && props.hasUnsavedChanges" text="Save your changes first" :delay-duration="0">
            <UButton
              size="xs"
              variant="soft"
              icon="i-lucide-send"
              disabled
            >
              Post
            </UButton>
          </UTooltip>
          <UButton
            v-else-if="connectionId"
            size="xs"
            variant="soft"
            icon="i-lucide-send"
            :loading="postingIndex === i"
            :disabled="postedIndices.has(i)"
            @click="handlePost(i)"
          >
            {{ postedIndices.has(i) ? 'Posted' : 'Post' }}
          </UButton>
        </div>
        <UAlert
          v-if="postResults[i]?.error"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="postResults[i].error"
          class="mt-2"
        />
        <UAlert
          v-if="postResults[i]?.success"
          color="success"
          variant="subtle"
          icon="i-lucide-check"
          title="Posted successfully"
          class="mt-2"
        />
      </div>
    </div>
    <p v-else class="py-4 text-center text-sm text-neutral-400">No items in feed</p>

    <UModal v-model:open="confirmOpen">
      <template #content>
        <div class="p-6 space-y-4">
          <h3 class="font-semibold text-lg">Confirm post</h3>
          <p class="text-sm text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap">{{ confirmText }}</p>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="confirmOpen = false">Cancel</UButton>
            <UButton color="primary" icon="i-lucide-send" :loading="postingIndex !== null" @click="confirmAndPost">Post</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </UCard>
</template>

<script setup lang="ts">
const props = defineProps<{
  sourceId: string
  template: string
  includeImages?: boolean
  connectionId?: string
  hasUnsavedChanges?: boolean
}>()

const emit = defineEmits<{
  imageStats: [{ total: number; withImages: number }]
}>()

const feedItems = ref<any[]>([])
const loading = ref(false)

const segmenter = new Intl.Segmenter()
const URL_REGEX = /https?:\/\/[^\s]+$/

function countGraphemes(text: string): number {
  return [...segmenter.segment(text)].length
}

function sliceGraphemes(text: string, count: number): string {
  return [...segmenter.segment(text)].slice(0, count).map(s => s.segment).join('')
}

function truncate(text: string, max: number): string {
  if (countGraphemes(text) <= max) return text
  const match = text.match(URL_REGEX)
  if (match) {
    const url = match[0]
    const prefix = text.slice(0, text.length - url.length).trimEnd()
    const urlGraphemes = countGraphemes(url)
    const prefixBudget = max - urlGraphemes - 2
    if (prefixBudget > 0) {
      return sliceGraphemes(prefix, prefixBudget) + '… ' + url
    }
  }
  return sliceGraphemes(text, max - 1) + '…'
}

function render(template: string, item: any): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const map: Record<string, string> = {
      title: item.title ?? '',
      link: item.link ?? '',
      description: item.description ?? '',
      content: item.content ?? '',
      author: item.author ?? '',
      date: item.pubDate ?? '',
    }
    return map[key] ?? ''
  })
}

const postingIndex = ref<number | null>(null)
const postedIndices = ref(new Set<number>())
const postResults = ref<Record<number, { success?: boolean; error?: string }>>({})

const confirmOpen = ref(false)
const pendingPostIndex = ref<number | null>(null)
const confirmText = computed(() => {
  if (pendingPostIndex.value === null) return ''
  return previewItems.value[pendingPostIndex.value]?.rendered ?? ''
})

function handlePost(index: number) {
  if (!props.connectionId) return
  pendingPostIndex.value = index
  confirmOpen.value = true
}

async function confirmAndPost() {
  const index = pendingPostIndex.value
  if (index === null || !props.connectionId) return
  confirmOpen.value = false
  postingIndex.value = index
  postResults.value[index] = {}
  try {
    await $fetch(`/api/connections/${props.connectionId}/post-item`, {
      method: 'POST',
      body: { itemIndex: index },
    })
    postedIndices.value.add(index)
    postResults.value[index] = { success: true }
  } catch (e: any) {
    postResults.value[index] = { error: e.data?.statusMessage || 'Failed to post' }
  } finally {
    postingIndex.value = null
    pendingPostIndex.value = null
  }
}

// Fetch feed items when sourceId changes
watch(() => props.sourceId, async (id) => {
  feedItems.value = []
  if (!id) return
  loading.value = true
  try {
    feedItems.value = await $fetch<typeof feedItems.value>(`/api/sources/${id}/items`)
    const withImages = feedItems.value.filter(i => i.images?.length > 0).length
    emit('imageStats', { total: feedItems.value.length, withImages })
  } catch {
    feedItems.value = []
  } finally {
    loading.value = false
  }
}, { immediate: true })

const previewItems = computed(() => {
  if (!feedItems.value.length || !props.template) return []
  return feedItems.value.map((item) => {
    const rendered = render(props.template, item)
    const rawGraphemes = countGraphemes(rendered)
    return {
      rendered: truncate(rendered, 300),
      graphemes: rawGraphemes,
      truncated: rawGraphemes > 300,
      images: props.includeImages ? (item.images ?? []) : [],
    }
  })
})
</script>
