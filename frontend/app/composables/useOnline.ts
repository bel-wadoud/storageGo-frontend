// Live online/offline state. Starts as "online" on the server and before hydration, so the
// first render never shows a false offline banner.
const online = ref(true)
let listening = false

export function useOnline() {
  if (import.meta.client && !listening) {
    listening = true
    online.value = navigator.onLine
    window.addEventListener('online', () => (online.value = true))
    window.addEventListener('offline', () => (online.value = false))
  }
  return readonly(online)
}
