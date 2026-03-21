<template>
  <UApp>
    <img
      src="/hero-canopy.png"
      alt=""
      class="fixed inset-0 w-full h-full object-cover -z-20"
    />
    <div
      class="fixed inset-0 -z-10 bg-onyx transition-opacity duration-700 ease-in-out"
      :class="isLanding ? 'opacity-0' : 'opacity-70'"
    />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
const route = useRoute()
const isLanding = computed(() => route.path === '/')
</script>
