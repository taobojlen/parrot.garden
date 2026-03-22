<template>
  <div class="relative min-h-screen text-pale-sky">
    <header class="border-b border-white/10 backdrop-blur-xl bg-black/60">
      <UContainer>
        <div class="flex items-center justify-between h-14">
          <div class="flex items-center gap-6">
            <NuxtLink to="/" class="text-lg font-bold text-white/90 hover:text-white transition-colors">
              🦜 parrot.garden
            </NuxtLink>
            <UNavigationMenu
              v-if="session?.data?.user"
              :items="navItems"
              variant="link"
            />
          </div>
          <div class="flex items-center gap-2">
            <template v-if="session?.data?.user">
              <UButton variant="ghost" color="neutral" @click="handleSignOut">
                Sign out
              </UButton>
            </template>
            <UButton v-else to="/login" variant="soft" class="!bg-white/15 !text-white hover:!bg-white/25">
              Sign in
            </UButton>
          </div>
        </div>
      </UContainer>
    </header>
    <UContainer>
      <main class="py-8">
        <slot />
      </main>
    </UContainer>
  </div>
</template>

<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const session = useSession()

const navItems: NavigationMenuItem[] = [
  { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/dashboard' },
  { label: 'Post Log', icon: 'i-lucide-scroll-text', to: '/log' },
]

async function handleSignOut() {
  await signOut()
  navigateTo('/')
}
</script>
