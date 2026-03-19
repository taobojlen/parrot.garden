export default defineNuxtRouteMiddleware((to) => {
  const session = useSession()
  const protectedPaths = ['/dashboard', '/sources', '/targets', '/connections', '/log']

  if (protectedPaths.some(p => to.path.startsWith(p)) && !session.value?.data?.user) {
    return navigateTo('/login')
  }

  if (to.path === '/login' && session.value?.data?.user) {
    return navigateTo('/dashboard')
  }
})
