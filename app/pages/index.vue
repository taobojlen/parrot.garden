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
        class="relative landing-glass
               px-10 py-12 sm:px-14 sm:py-16 max-w-lg w-full text-center"
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

<style scoped>
.landing-glass {
  background-color: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  border-radius: 2rem;
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
</style>

<script setup lang="ts">
definePageMeta({
  layout: 'landing',
})

useSeoMeta({
  title: 'parrot.garden — Cross-post RSS feeds to Bluesky, Mastodon & more',
  description: 'Publish on your own site, syndicate everywhere. Automatically cross-post your RSS feeds to Bluesky, Mastodon, and more — POSSE made easy.',
  ogTitle: 'parrot.garden — Cross-post RSS feeds to Bluesky, Mastodon & more',
  ogDescription: 'Publish on your own site, syndicate everywhere. Automatically cross-post your RSS feeds to Bluesky, Mastodon, and more — POSSE made easy.',
  ogType: 'website',
  ogImage: 'https://parrot.garden/og-image.png',
  ogImageWidth: 1200,
  ogImageHeight: 630,
  twitterCard: 'summary_large_image',
  twitterImage: 'https://parrot.garden/og-image.png',
  twitterTitle: 'parrot.garden — Cross-post RSS feeds to social media',
  twitterDescription: 'Publish on your own site, syndicate everywhere. Cross-post your RSS feeds to Bluesky, Mastodon, and more — POSSE made easy.',
})

useSchemaOrg([
  defineWebSite({
    name: 'parrot.garden',
    description: 'Publish on your own site, syndicate everywhere. Cross-post your RSS feeds to Bluesky, Mastodon, and more — POSSE made easy.',
  }),
  defineWebPage({
    name: 'parrot.garden — Cross-post RSS feeds to Bluesky, Mastodon & more',
    description: 'Publish on your own site, syndicate everywhere. Automatically cross-post your RSS feeds to Bluesky, Mastodon, and more — POSSE made easy.',
  }),
])
</script>
