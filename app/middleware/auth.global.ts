export default defineNuxtRouteMiddleware((to) => {
  const session = useSession()
  const protectedPaths = ['/dashboard', '/sources', '/targets', '/connections', '/log']

  // Don't redirect while session is still loading to avoid flash redirects
  if (session.value?.isPending) return

  if (protectedPaths.some(p => to.path.startsWith(p)) && !session.value?.data?.user) {
    return navigateTo('/login')
  }

  if (to.path === '/login' && session.value?.data?.user) {
    return navigateTo('/dashboard')
  }
})
