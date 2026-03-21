<template>
  <div class="min-h-screen bg-onyx text-pale-sky">
    <div class="absolute top-0 right-0 z-10 p-4">
      <UButton to="/login" variant="soft" class="!bg-white/15 !text-white hover:!bg-white/25">
        Sign in
      </UButton>
    </div>
    <slot />
  </div>
</template>
