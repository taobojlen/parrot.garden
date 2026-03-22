export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/' || to.path === '/og-image') return

  const { data: session } = await useSession(useFetch)

  if (to.path === '/login') {
    if (session.value) return navigateTo('/dashboard')
    return
  }

  if (!session.value) {
    return navigateTo('/login')
  }
})
