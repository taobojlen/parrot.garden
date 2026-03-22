<template>
  <UApp>
    <img
      ref="bgImg"
      src="/hero-canopy.png"
      alt=""
      class="fixed inset-0 w-full h-full object-cover -z-20 transition-opacity duration-500"
      :class="bgLoaded ? 'opacity-100' : 'opacity-0'"
      @load="bgLoaded = true"
    />
    <div
      class="fixed inset-0 -z-10 bg-onyx opacity-0"
    />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
const bgLoaded = ref(false)
const bgImg = ref<HTMLImageElement>()

onMounted(() => {
  if (bgImg.value?.complete) bgLoaded.value = true
})
</script>
