<template>
  <div class="min-h-screen text-pale-sky">
    <div class="absolute top-0 right-0 z-10 p-4">
      <UButton
        :to="session?.data?.user ? '/dashboard' : '/login'"
        variant="soft"
        class="!bg-white/15 !text-white hover:!bg-white/25"
      >
        {{ session?.data?.user ? 'Dashboard' : 'Sign in' }}
      </UButton>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
const session = useSession()
</script>
