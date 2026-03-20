<template>
  <div class="mx-auto max-w-lg">
    <div class="flex items-center gap-2 mb-6">
      <UButton to="/dashboard" variant="ghost" color="neutral" icon="i-lucide-arrow-left" size="sm" />
      <h1 class="text-2xl font-bold ">Add Target</h1>
    </div>
    <UCard>
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
        </div>
        <div class="flex items-center gap-2 mt-6">
          <UButton type="submit" :loading="loading">Add Target</UButton>
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
const targetTypes = [{ label: 'Bluesky', value: 'bluesky' }]
const form = reactive({ name: '', type: 'bluesky' })
const credentials = reactive({ handle: '', appPassword: '' })
const loading = ref(false)
const error = ref('')

const formState = computed(() => ({ ...form, ...credentials }))

async function handleSubmit() {
  loading.value = true
  error.value = ''
  try {
    const created = await $fetch('/api/targets', { method: 'POST', body: { ...form, credentials } })
    navigateTo(`/targets/${created.id}`)
  } catch (e: any) {
    error.value = e.data?.statusMessage || 'Failed to add target'
  } finally {
    loading.value = false
  }
}
</script>
