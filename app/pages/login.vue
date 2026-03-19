<template>
  <div class="mx-auto max-w-sm mt-20">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-bold">Sign in to Parrot</h1>
        <p class="text-gray-500 mt-1">We'll send you a magic link</p>
      </template>

      <form v-if="!sent" @submit.prevent="handleSubmit">
        <UFormField label="Email">
          <UInput v-model="email" type="email" placeholder="you@example.com" required />
        </UFormField>
        <UButton type="submit" class="mt-4 w-full" :loading="loading">
          Send magic link
        </UButton>
        <p v-if="error" class="text-red-500 mt-2 text-sm">{{ error }}</p>
      </form>

      <div v-else class="text-center py-4">
        <p class="text-lg">Check your email!</p>
        <p class="text-gray-500 mt-2">We sent a magic link to <strong>{{ email }}</strong></p>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const email = ref('')
const loading = ref(false)
const sent = ref(false)
const error = ref('')

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
