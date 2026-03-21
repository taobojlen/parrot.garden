<template>
  <UModal v-model:open="open">
    <template #content>
      <div class="p-6 space-y-4">
        <h3 class="font-semibold text-lg">{{ title }}</h3>
        <p class="text-sm text-pale-sky/80">{{ message }}</p>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="open = false">Cancel</UButton>
          <UButton :color="confirmColor" :icon="confirmIcon" :loading="loading" @click="$emit('confirm')">
            {{ confirmLabel }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })

withDefaults(defineProps<{
  title: string
  message: string
  confirmLabel?: string
  confirmColor?: string
  confirmIcon?: string
  loading?: boolean
}>(), {
  confirmLabel: 'Confirm',
  confirmColor: 'error',
  confirmIcon: 'i-lucide-trash-2',
  loading: false,
})

defineEmits<{
  confirm: []
}>()
</script>
