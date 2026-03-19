import { createAuthClient } from 'better-auth/vue'
import { magicLinkClient } from 'better-auth/client/plugins'

export const { useSession, signIn, signUp, signOut } = createAuthClient({
  plugins: [magicLinkClient()],
})
