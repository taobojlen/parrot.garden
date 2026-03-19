<template>
  <div class="mx-auto max-w-lg">
    <h1 class="text-2xl font-bold mb-6">Add Target</h1>
    <UCard>
      <form @submit.prevent="handleSubmit">
        <div class="space-y-4">
          <UFormField label="Name">
            <UInput v-model="form.name" placeholder="My Bluesky" required />
          </UFormField>
          <UFormField label="Type">
            <USelect v-model="form.type" :items="targetTypes" required />
          </UFormField>
          <template v-if="form.type === 'bluesky'">
            <UFormField label="Handle">
              <UInput v-model="credentials.handle" placeholder="you.bsky.social" required />
            </UFormField>
            <UFormField label="App Password" hint="Generate at Settings → App Passwords on Bluesky">
              <UInput v-model="credentials.appPassword" type="password" placeholder="xxxx-xxxx-xxxx-xxxx" required />
            </UFormField>
          </template>
        </div>
        <div class="flex gap-2 mt-6">
          <UButton type="submit" :loading="loading">Add Target</UButton>
          <NuxtLink to="/dashboard"><UButton variant="ghost">Cancel</UButton></NuxtLink>
        </div>
        <p v-if="error" class="text-red-500 mt-2 text-sm">{{ error }}</p>
      </form>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const targetTypes = [{ label: 'Bluesky', value: 'bluesky' }]
const form = reactive({ name: '', type: 'bluesky' })
const credentials = reactive({ handle: '', appPassword: '' })
const loading = ref(false)
const error = ref('')

async function handleSubmit() {
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/targets', { method: 'POST', body: { ...form, credentials } })
    navigateTo('/dashboard')
  } catch (e: any) {
    error.value = e.data?.statusMessage || 'Failed to add target'
  } finally {
    loading.value = false
  }
}
</script>
