<template>
  <div class="mx-auto max-w-lg">
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UButton to="/dashboard" variant="ghost" color="neutral" icon="i-lucide-arrow-left" size="sm" />
          <h1 class="text-2xl font-bold">Add Target</h1>
        </div>
      </template>
      <UForm :state="formState" @submit="handleSubmit">
        <div class="space-y-4">
          <UFormField label="Name" name="name" required>
            <UInput v-model="form.name" placeholder="My Bluesky" icon="i-lucide-type" required class="w-full" />
          </UFormField>
          <UFormField label="Type" name="type" required>
            <USelect v-model="form.type" :items="targetTypes" value-key="value" required class="w-full" />
          </UFormField>
          <template v-if="form.type === 'bluesky'">
            <USeparator />
            <UFormField label="Handle" name="handle" required>
              <UInput v-model="credentials.handle" placeholder="you.bsky.social" icon="i-lucide-at-sign" required class="w-full" />
            </UFormField>
            <UFormField label="App Password" name="appPassword" hint="Generate at Settings > App Passwords on Bluesky" required>
              <UInput v-model="credentials.appPassword" type="password" placeholder="xxxx-xxxx-xxxx-xxxx" icon="i-lucide-key-round" required class="w-full" />
            </UFormField>
          </template>
          <template v-if="form.type === 'mastodon'">
            <USeparator />
            <UFormField label="Instance URL" name="instanceUrl" required>
              <UInput v-model="mastodonInstance" placeholder="mastodon.social" icon="i-lucide-globe" required class="w-full" />
            </UFormField>
          </template>
        </div>
        <div class="flex items-center gap-2 mt-6">
          <UButton v-if="form.type === 'mastodon'" type="submit" :loading="loading" icon="i-lucide-external-link">
            Authorize with Mastodon
          </UButton>
          <UButton v-else type="submit" :loading="loading">Add Target</UButton>
          <UButton to="/dashboard" variant="ghost" color="neutral">Cancel</UButton>
        </div>
      </UForm>
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
const targetTypes = [
  { label: 'Bluesky', value: 'bluesky' },
  { label: 'Mastodon', value: 'mastodon' },
]
const form = reactive({ name: '', type: 'bluesky' })
const credentials = reactive({ handle: '', appPassword: '' })
const mastodonInstance = ref('')
const loading = ref(false)
const error = ref('')

const formState = computed(() => ({ ...form, ...credentials, instanceUrl: mastodonInstance.value }))

async function handleSubmit() {
  loading.value = true
  error.value = ''
  try {
    if (form.type === 'mastodon') {
      const { url } = await $fetch('/api/targets/mastodon/authorize', {
        method: 'POST',
        body: { instanceUrl: mastodonInstance.value, targetName: form.name },
      })
      window.location.href = url
    } else {
      const created = await $fetch('/api/targets', { method: 'POST', body: { ...form, credentials } })
      navigateTo(`/targets/${created.id}`)
    }
  } catch (e: any) {
    error.value = e.data?.statusMessage || 'Failed to add target'
  } finally {
    loading.value = false
  }
}
</script>
