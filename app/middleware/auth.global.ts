export default defineNuxtRouteMiddleware(async (to) => {
  // Public pages — never redirect
  if (to.path === '/' || to.path === '/login') return

  const { data: session } = await useSession(useFetch)

  if (!session.value) {
    return navigateTo('/login')
  }
})
