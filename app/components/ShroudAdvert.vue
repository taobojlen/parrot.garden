<template>
  <aside
    v-if="session?.data?.user && !dismissed"
    aria-label="Shroud.email advert"
    class="relative bg-default text-pale-sky max-w-xl mx-auto mb-6 px-5 py-4 lg:fixed lg:bottom-6 lg:right-6 lg:z-40 lg:w-96 lg:mb-0"
  >
    <a
      href="https://shroud.email/?utm_source=parrot.garden&utm_medium=referral&utm_campaign=shroud_advert"
      target="_blank"
      rel="noopener"
      class="block pr-8 rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pale-sky group"
    >
      <h2 class="text-base font-semibold group-hover:underline underline-offset-4">
        Email, meet privacy
      </h2>
      <p class="mt-1 text-sm leading-relaxed">
        If you like parrot.garden, try my other project: free email aliases that keep your real address private.
      </p>
      <span class="mt-2 block text-sm font-semibold group-hover:underline underline-offset-4">Try Shroud.email →</span>
    </a>
    <button
      type="button"
      aria-label="Dismiss Shroud.email advert"
      class="absolute top-2 right-2 flex size-9 items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-pale-sky"
      @click="dismissed = true"
    >
      <UIcon name="i-lucide-x" class="size-4" aria-hidden="true" />
    </button>
  </aside>
</template>

<script setup lang="ts">
const session = useSession()
const dismissed = useCookie<boolean>('shroud-advert-dismissed', {
  default: () => false,
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
})
</script>
