<template>
  <UPageHero
    title="Parrot"
    description="Cross-post your RSS feeds to Bluesky, Mastodon, and more."
    :links="[
      { label: 'Get Started', to: '/login', icon: 'i-lucide-arrow-right', trailing: true, size: 'lg' },
      { label: 'Learn More', to: '#features', variant: 'soft', color: 'neutral', size: 'lg' }
    ]"
  />

  <div id="features" class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto py-12">
    <UCard>
      <div class="flex flex-col items-center text-center gap-3 p-2">
        <UIcon name="i-lucide-rss" class="text-3xl text-primary" />
        <h3 class="font-semibold text-lg">RSS Sources</h3>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">Connect any RSS or Atom feed as a content source.</p>
      </div>
    </UCard>
    <UCard>
      <div class="flex flex-col items-center text-center gap-3 p-2">
        <UIcon name="i-lucide-share-2" class="text-3xl text-primary" />
        <h3 class="font-semibold text-lg">Social Targets</h3>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">Post to Bluesky with more platforms coming soon.</p>
      </div>
    </UCard>
    <UCard>
      <div class="flex flex-col items-center text-center gap-3 p-2">
        <UIcon name="i-lucide-link" class="text-3xl text-primary" />
        <h3 class="font-semibold text-lg">Connections</h3>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">Map sources to targets with customizable templates.</p>
      </div>
    </UCard>
  </div>
</template>
