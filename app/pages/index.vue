<template>
  <div>
    <!-- Hero -->
    <div class="relative w-full h-[60vh] min-h-[420px]">
      <!-- Frosted glass panel -->
      <div class="absolute inset-0 flex items-start justify-center pt-[4%] p-6">
        <div
          class="relative landing-glass
                 px-10 py-12 sm:px-14 sm:py-16 max-w-2xl w-full text-center"
        >
          <h1 class="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-2">
            🦜 Parrot.garden
          </h1>
          <p class="text-base sm:text-lg text-white/60 mb-6 italic">
            "It repeats your stuff!"
          </p>
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

    <!-- Content sections -->
    <div class="landing-cards max-w-2xl mx-auto px-6 pb-20 -mt-16 space-y-8">

      <!-- POSSE explainer -->
      <UCard>
        <div class="text-center">
          <h2 class="text-2xl font-semibold text-white mb-4">
            Own your content
          </h2>
          <p class="text-pale-sky leading-relaxed">
            You publish on your own site. Parrot sends it everywhere else.
            This is the
            <a
              href="https://indieweb.org/POSSE"
              target="_blank"
              rel="noopener"
              class="text-sky-reflection hover:text-pale-sky underline underline-offset-2 transition-colors"
            >POSSE</a>
            pattern — Publish on your Own Site, Syndicate Elsewhere.
            Your blog stays the source of truth, and social platforms are just
            distribution.
          </p>
        </div>
      </UCard>

      <!-- Supported platforms -->
      <UCard>
        <div class="text-center">
          <h2 class="text-2xl font-semibold text-white mb-6">
            Supported platforms
          </h2>
          <div class="flex justify-center gap-10">
            <div class="flex flex-col items-center gap-2">
              <UIcon name="i-simple-icons-bluesky" class="text-3xl text-sky-reflection" />
              <span class="text-pale-sky text-sm">Bluesky</span>
            </div>
            <div class="flex flex-col items-center gap-2">
              <UIcon name="i-simple-icons-mastodon" class="text-3xl text-sky-reflection" />
              <span class="text-pale-sky text-sm">Mastodon</span>
            </div>
          </div>
          <p class="text-pale-sky text-sm mt-4">
            More coming soon.
          </p>
        </div>
      </UCard>

      <!-- Free callout -->
      <UCard>
        <div class="text-center">
          <h2 class="text-2xl font-semibold text-white mb-4">
            Free for everyone
          </h2>
          <p class="text-pale-sky leading-relaxed">
            I built this to scratch my own itch.
            Feel free to use it for anything you want
            whether it's personal or commercial.

            No cost or need to host anything yourself!
          </p>
        </div>
      </UCard>

    </div>

    <!-- Footer -->
    <div class="pb-8">
      <GlassFooter />
    </div>
  </div>
</template>

<style scoped>
.landing-glass {
  background-color: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  border-radius: 0.875rem;
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

.landing-cards :deep(.bg-default) {
  background-color: rgba(0, 0, 0, 0.35) !important;
}
</style>

<script setup lang="ts">
definePageMeta({
  layout: 'landing',
})

useHead({
  meta: [
    { property: 'og:logo', content: 'https://parrot.garden/favicon.svg' },
  ],
})

useSeoMeta({
  title: 'parrot.garden — Cross-post RSS to Bluesky & Mastodon',
  description: 'Publish on your own site, syndicate everywhere. Automatically cross-post your RSS feeds to Bluesky, Mastodon, and more — POSSE made easy.',
  ogTitle: 'parrot.garden — Cross-post RSS to Bluesky & Mastodon',
  ogDescription: 'Publish on your own site, syndicate everywhere. Automatically cross-post your RSS feeds to Bluesky, Mastodon, and more — POSSE made easy.',
  ogType: 'website',
  ogImage: 'https://parrot.garden/og-image.webp',
  ogImageWidth: 1200,
  ogImageHeight: 630,
  twitterCard: 'summary_large_image',
  twitterImage: 'https://parrot.garden/og-image.webp',
  twitterTitle: 'parrot.garden — Cross-post RSS feeds to social media',
  twitterDescription: 'Publish on your own site, syndicate everywhere. Cross-post your RSS feeds to Bluesky, Mastodon, and more — POSSE made easy.',
})

useSchemaOrg([
  defineWebSite({
    name: 'parrot.garden',
    description: 'Publish on your own site, syndicate everywhere. Cross-post your RSS feeds to Bluesky, Mastodon, and more — POSSE made easy.',
  }),
  defineWebPage({
    name: 'parrot.garden — Cross-post RSS to Bluesky & Mastodon',
    description: 'Publish on your own site, syndicate everywhere. Automatically cross-post your RSS feeds to Bluesky, Mastodon, and more — POSSE made easy.',
  }),
])
</script>
