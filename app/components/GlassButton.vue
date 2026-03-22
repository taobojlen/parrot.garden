<template>
  <NuxtLink v-if="to" :to="to" class="glass-btn" v-bind="$attrs">
    <UIcon v-if="icon" :name="icon" class="glass-btn__icon" />
    <span v-if="$slots.default" class="glass-btn__label"><slot /></span>
  </NuxtLink>
  <button v-else class="glass-btn" v-bind="$attrs">
    <UIcon v-if="icon" :name="icon" class="glass-btn__icon" />
    <span v-if="$slots.default" class="glass-btn__label"><slot /></span>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  icon?: string
  to?: string
}>()
</script>

<style scoped>
.glass-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 40px;
  padding: 0 16px;
  border: none;
  border-radius: 99em;
  background-color: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  color: rgba(209, 224, 232, 0.6);
  text-decoration: none;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 500;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.1),
    inset 1.8px 3px 0px -2px rgba(255, 255, 255, 0.15),
    inset -2px -2px 0px -2px rgba(255, 255, 255, 0.12),
    inset -3px -8px 1px -6px rgba(255, 255, 255, 0.08),
    inset -0.3px -1px 4px 0px rgba(0, 0, 0, 0.24),
    inset -1.5px 2.5px 0px -2px rgba(0, 0, 0, 0.2),
    inset 0px 3px 4px -2px rgba(0, 0, 0, 0.2),
    inset 2px -6.5px 1px -4px rgba(0, 0, 0, 0.1),
    0px 1px 5px 0px rgba(0, 0, 0, 0.2),
    0px 6px 16px 0px rgba(0, 0, 0, 0.16);
  transition: color 200ms, background-color 200ms;
}

.glass-btn:hover {
  color: var(--color-pale-sky);
  background-color: rgba(0, 0, 0, 0.45);
}

.glass-btn__icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
</style>
