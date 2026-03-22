<template>
  <nav class="switcher" ref="switcherEl">
    <NuxtLink
      v-for="(item, index) in items"
      :key="item.to"
      :to="item.to"
      class="switcher__option"
      :data-active="isActive(item.to) || undefined"
    >
      <UIcon :name="item.icon" class="switcher__icon" />
      <span class="switcher__label">{{ item.label }}</span>
    </NuxtLink>
    <div class="switcher__indicator" :style="{ '--active': activeIndex }" />
  </nav>
</template>

<script setup lang="ts">
interface SwitcherItem {
  label: string
  icon: string
  to: string
}

const props = defineProps<{
  items: SwitcherItem[]
}>()

const route = useRoute()

function isActive(to: string): boolean {
  return route.path === to || route.path.startsWith(to + '/')
}

const activeIndex = computed(() => {
  const idx = props.items.findIndex(item => isActive(item.to))
  return idx >= 0 ? idx : 0
})

// activeIndex is used as a CSS custom property --active
</script>

<style scoped>
.switcher {
  position: fixed;
  z-index: 50;
  top: 20px;
  left: 50%;
  translate: -50%;
  display: flex;
  align-items: center;
  gap: 0;
  height: 48px;
  box-sizing: border-box;
  padding: 5px;
  margin: 0 auto;
  border: none;
  border-radius: 99em;
  background-color: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
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
}

.switcher__option {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1;
  justify-content: center;
  align-items: center;
  gap: 6px;
  padding: 0 20px;
  height: 100%;
  box-sizing: border-box;
  border-radius: 99em;
  color: rgba(209, 224, 232, 0.5);
  text-decoration: none;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 500;
  transition: color 200ms;
}

.switcher__option:hover {
  color: rgba(209, 224, 232, 0.8);
}

.switcher__option[data-active] {
  color: var(--color-pale-sky);
}

.switcher__icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  transition: transform 200ms cubic-bezier(0.5, 0, 0, 1);
}

.switcher__option:hover .switcher__icon {
  transform: scale(1.15);
}

.switcher__option[data-active] .switcher__icon {
  transform: scale(1);
}

.switcher__label {
  display: block;
}

.switcher__indicator {
  position: absolute;
  left: 5px;
  top: 5px;
  width: 50%;
  height: calc(100% - 10px);
  border-radius: 99em;
  background-color: rgba(255, 255, 255, 0.1);
  z-index: 0;
  pointer-events: none;
  translate: calc(var(--active) * (100% - 10px)) 0;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    inset 2px 1px 0px -1px rgba(255, 255, 255, 0.12),
    inset -1.5px -1px 0px -1px rgba(255, 255, 255, 0.1),
    inset -2px -6px 1px -5px rgba(255, 255, 255, 0.06),
    inset -1px 2px 3px -1px rgba(0, 0, 0, 0.2),
    inset 0px -4px 1px -2px rgba(0, 0, 0, 0.1),
    0px 3px 6px 0px rgba(0, 0, 0, 0.12);
  transition:
    translate 400ms cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
