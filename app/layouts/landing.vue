<template>
  <div class="min-h-screen text-pale-sky">
    <div class="fixed top-5 right-5 z-50">
      <GlassButton
        :to="session?.data?.user ? '/dashboard' : '/login'"
        :icon="session?.data?.user ? 'i-lucide-layout-dashboard' : 'i-lucide-log-in'"
      >
        {{ session?.data?.user ? 'Dashboard' : 'Sign in' }}
      </GlassButton>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
const session = useSession()
</script>
