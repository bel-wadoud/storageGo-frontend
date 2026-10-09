// App pages need a signed-in account whose keys are unlocked in this tab. A reload clears the
// keys (by design), so the user unlocks again and comes straight back to the same page.
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return
  const { account } = useAccount()
  // Plain statements (no await inside expressions): Nuxt rewrites awaits in middleware.
  let unlocked = false
  if (cryptoSupported()) {
    const engine = await useCrypto()
    unlocked = await engine.isUnlocked()
  }
  if (account.value && unlocked) {
    // The drive stays closed until the recovery kit is confirmed (user-flows.md F1).
    if (!account.value.kit_verified) return useSignup().resumeKit(account.value)
    return
  }
  return navigateTo({ path: '/signin/unlock', query: { next: to.fullPath } }, { replace: true })
})
