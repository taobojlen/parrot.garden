export default defineNuxtPlugin(async () => {
  // Better Auth's Vue integration handles SSR session fetching automatically
  // useSession() is reactive and will be populated during SSR
})
