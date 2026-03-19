<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <UContainer>
      <header class="flex items-center justify-between py-4">
        <NuxtLink to="/" class="text-xl font-bold">Parrot</NuxtLink>
        <nav v-if="session?.data?.user" class="flex items-center gap-4">
          <NuxtLink to="/dashboard">Dashboard</NuxtLink>
          <NuxtLink to="/log">Log</NuxtLink>
          <UButton variant="ghost" @click="handleSignOut">Sign out</UButton>
        </nav>
        <NuxtLink v-else to="/login">
          <UButton>Sign in</UButton>
        </NuxtLink>
      </header>
      <main class="py-8">
        <slot />
      </main>
    </UContainer>
  </div>
</template>

<script setup lang="ts">
const session = useSession()

async function handleSignOut() {
  await signOut()
  navigateTo('/')
}
</script>
