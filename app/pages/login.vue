<template>
  <div class="mx-auto max-w-sm mt-12">
    <UCard>
      <template #header>
        <div class="flex flex-col gap-1">
          <h1 class="text-2xl font-bold text-(--ui-text-highlighted)">Sign in to Parrot</h1>
          <p class="text-sm text-(--ui-text-muted)">We'll send you a magic link</p>
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
            />
          </UFormField>
          <UButton type="submit" block :loading="loading">
            Send magic link
          </UButton>
        </div>
      </UForm>

      <div v-else class="text-center py-6">
        <UIcon name="i-lucide-mail-check" class="text-4xl text-(--ui-primary) mb-3" />
        <p class="text-lg font-medium text-(--ui-text-highlighted)">Check your email!</p>
        <p class="text-sm text-(--ui-text-muted) mt-2">
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
const email = ref('')
const loading = ref(false)
const sent = ref(false)
const error = ref('')

const formState = computed(() => ({ email: email.value }))

async function handleSubmit() {
  loading.value = true
  error.value = ''
  try {
    await signIn.magicLink({ email: email.value, callbackURL: '/dashboard' })
    sent.value = true
  }
  catch (e: any) {
    error.value = e.message || 'Failed to send magic link'
  }
  finally {
    loading.value = false
  }
}
</script>
