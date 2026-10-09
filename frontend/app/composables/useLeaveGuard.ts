import type { RouteLocationNormalized } from 'vue-router'

// Asks before leaving a page whose work would be lost (e.g. the recovery kit before it is
// verified). Closing or reloading the tab gets the browser's own prompt; in-app navigation
// opens our dialog instead. Routes for which `allow(to)` is true pass without asking.
export function useLeaveGuard(active: Ref<boolean> | ComputedRef<boolean>, allow: (to: RouteLocationNormalized) => boolean) {
  const asking = ref(false)
  let pending: string | null = null
  let confirmed = false

  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (!active.value) return
    event.preventDefault()
    // Older browsers need returnValue set to show the prompt.
    event.returnValue = ''
  }

  onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))

  onBeforeRouteLeave((to) => {
    if (confirmed || !active.value || allow(to)) return true
    pending = to.fullPath
    asking.value = true
    return false
  })

  return {
    asking,
    stay() {
      asking.value = false
      pending = null
    },
    leave() {
      asking.value = false
      confirmed = true
      if (pending) navigateTo(pending)
    },
  }
}
