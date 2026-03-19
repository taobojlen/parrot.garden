<template>
  <div class="min-h-screen">
    <header class="border-b border-neutral-200 dark:border-neutral-800">
      <UContainer>
        <div class="flex items-center justify-between h-14">
          <div class="flex items-center gap-6">
            <NuxtLink to="/" class="text-lg font-bold">
              Parrot
            </NuxtLink>
            <UNavigationMenu
              v-if="session?.data?.user"
              :items="navItems"
              variant="link"
            />
          </div>
          <div class="flex items-center gap-2">
            <UColorModeButton />
            <template v-if="session?.data?.user">
              <UButton variant="ghost" color="neutral" @click="handleSignOut">
                Sign out
              </UButton>
            </template>
            <UButton v-else to="/login" variant="soft">
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
