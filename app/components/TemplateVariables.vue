<template>
  <div class="flex flex-wrap gap-1.5">
    <UTooltip v-for="v in variables" :key="v.name" :text="v.description" :delay-duration="0">
      <button
        type="button"
        class="variable-pill"
        @click="$emit('insert', `{{${v.name}}}`)"
      >
        {{ v.name }}
      </button>
    </UTooltip>
  </div>
</template>

<script setup lang="ts">
defineEmits<{
  insert: [value: string]
}>()

const variables = [
  { name: 'title', description: 'Title of the feed item' },
  { name: 'link', description: 'URL of the feed item' },
  { name: 'description', description: 'Short summary or excerpt' },
  { name: 'content', description: 'Full content of the item' },
  { name: 'author', description: 'Author of the feed item' },
  { name: 'date', description: 'Publication date' },
]
</script>

<style scoped>
.variable-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 500;
  font-family: ui-monospace, monospace;
  border-radius: 99em;
  background-color: rgba(255, 255, 255, 0.08);
  color: var(--color-pale-sky);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: background-color 150ms, color 150ms;
}

.variable-pill:hover {
  background-color: rgba(255, 255, 255, 0.15);
  color: var(--color-pale-sky);
}
</style>
