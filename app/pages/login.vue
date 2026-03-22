<template>
  <div class="mx-auto max-w-sm mt-12">
    <UCard>
      <template #header>
        <div class="flex flex-col gap-1">
          <h1 class="text-2xl font-bold">Sign in to parrot.garden</h1>
          <p class="text-sm text-sky-reflection/70">We'll send you a magic link</p>
        </div>
      </template>

      <UForm v-if="!sent" :state="formState" @submit="handleSubmit">
        <div class="space-y-4">
          <UFormField label="Email" name="email" required>
            <UInput
              v-model="email"
              type="email"
              placeholder="you@example.com"
              icon="i-lucide-mail"
              required
              class="w-full"
            />
          </UFormField>
          <UButton type="submit" block :loading="loading">
            Send magic link
          </UButton>
        </div>
      </UForm>

      <div v-else class="text-center py-6">
        <UIcon name="i-lucide-mail-check" class="text-4xl text-primary mb-3" />
        <p class="text-lg font-medium">Check your email!</p>
        <p class="text-sm text-sky-reflection/70 mt-2">
          We sent a magic link to <strong>{{ email }}</strong>
        </p>
      </div>

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="error"
        class="mt-4"
      />
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  robots: 'noindex, nofollow',
})

const email = ref('')
const loading = ref(false)
const sent = ref(false)
const error = ref('')

const formState = computed(() => ({ email: email.value }))

async function handleSubmit() {
  loading.value = true
  error.value = ''
  const result = await signIn.magicLink({ email: email.value, callbackURL: '/dashboard' })
  loading.value = false
  if (result.error) {
    error.value = result.error.message || 'Failed to send magic link'
  }
  else {
    sent.value = true
  }
}
</script>
