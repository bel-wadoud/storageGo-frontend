import type { SigninStep } from '~/composables/useSignin'

declare module '#app' {
  interface PageMeta {
    signinStep?: SigninStep
  }
}

// Keeps the sign-in steps in order (no passphrase page without an email, no approval page
// without a pending request) and remembers a checked ?next= for after sign-in.
export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return
  const step = to.meta.signinStep
  if (!step) return
  const { draft, update, resumePath } = useSignin()
  const next = safeNext(to.query.next)
  if (next && next !== draft.value.next) update({ next })
  if (!signinStepAllowed(step, draft.value)) return navigateTo(resumePath(), { replace: true })
})
