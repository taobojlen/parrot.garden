<template>
  <div class="og-page">
    <img
      src="/hero-canopy.png"
      alt=""
      class="og-bg"
    />
    <div class="og-container">
      <div class="og-glass">
        <h1 class="og-title">🦜 parrot.garden</h1>
        <p class="og-tagline">
          Cross-post your RSS feeds to<br>Bluesky, Mastodon, and more.
        </p>
        <div class="og-platforms">
          <div class="og-platform">
            <UIcon name="i-simple-icons-rss" />
          </div>
          <div class="og-divider" />
          <div class="og-platform">
            <UIcon name="i-simple-icons-bluesky" />
          </div>
          <div class="og-divider" />
          <div class="og-platform">
            <UIcon name="i-simple-icons-mastodon" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.og-page {
  width: 1200px;
  height: 630px;
  overflow: hidden;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.og-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.og-container {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.og-glass {
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
  padding: 56px 96px 64px;
  text-align: center;
  max-width: 960px;
}
.og-title {
  font-size: 68px;
  font-weight: 700;
  color: white;
  letter-spacing: -0.02em;
  margin-bottom: 12px;
}
.og-tagline {
  font-size: 36px;
  color: white;
  line-height: 1.4;
  margin-bottom: 28px;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.og-platforms {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 36px;
}
.og-platform {
  display: flex;
  align-items: center;
  color: rgba(255, 255, 255, 0.9);
  font-size: 44px;
}
.og-divider {
  width: 1px;
  height: 32px;
  background: rgba(255, 255, 255, 0.25);
}
</style>

<script setup lang="ts">
definePageMeta({
  layout: false,
  robots: 'noindex, nofollow',
})
</script>
