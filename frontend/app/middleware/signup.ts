import type { SignupStep } from '~/composables/useSignup'

declare module '#app' {
  interface PageMeta {
    signupStep?: SignupStep
  }
}

// Keeps the signup flow in order: a step that isn't reachable yet (or can't be redone) sends
// the user to the step they should be on. Progress lives in sessionStorage, so this runs in
// the browser; the steps after the first two are client-rendered (see routeRules).
export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return
  const step = to.meta.signupStep
  if (!step) return
  const { draft, resumePath } = useSignup()
  if (!stepAllowed(step, draft.value)) return navigateTo(resumePath(), { replace: true })
})
