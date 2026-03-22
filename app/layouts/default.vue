<template>
  <div class="relative min-h-screen text-pale-sky">
    <GlassSwitcher v-if="session?.data?.user" :items="navItems" />
    <div v-if="session?.data?.user" class="fixed top-5 right-5 z-50">
      <GlassButton icon="i-lucide-log-out" title="Sign out" @click="handleSignOut" />
    </div>
    <UContainer>
      <main class="pt-24 pb-8">
        <slot />
      </main>
    </UContainer>
  </div>
</template>

<script setup lang="ts">
const session = useSession()

const navItems = [
  { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/dashboard' },
  { label: 'Post Log', icon: 'i-lucide-scroll-text', to: '/log' },
]

async function handleSignOut() {
  await signOut()
  navigateTo('/')
}
</script>
