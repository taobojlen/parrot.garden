<template>
  <div class="relative w-full h-screen overflow-hidden">
    <img
      src="/hero-canopy.png"
      alt=""
      class="absolute inset-0 w-full h-full object-cover"
    />

    <!-- Bottom fade into background -->
    <div class="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-onyx to-transparent" />

    <!-- Frosted glass panel -->
    <div class="absolute inset-0 flex items-start justify-center pt-[8%] p-6">
      <div
        class="relative backdrop-blur-xl bg-black/15 border border-white/20 rounded-3xl
               px-10 py-12 sm:px-14 sm:py-16 max-w-lg w-full text-center
               shadow-2xl shadow-black/20"
      >
        <h1 class="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-3">
          🦜 parrot.garden
        </h1>
        <p class="text-lg sm:text-xl text-white mb-8 leading-relaxed drop-shadow-md">
          Cross-post your RSS feeds to Bluesky, Mastodon, and more.
        </p>
        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          <UButton
            to="/dashboard"
            size="lg"
            icon="i-lucide-arrow-right"
            trailing
            class="justify-center !bg-white/20 !text-white hover:!bg-white/30"
          >
            Get Started
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'landing',
})
</script>
