// Time left until a moment (a rate-limit pause, an approval request expiring), refreshed
// every second while the page is open. `label` reads "4:05".
export function useCountdown() {
  const until = ref(0)
  const now = ref(Date.now())
  let tick: ReturnType<typeof setInterval> | undefined

  onMounted(() => (tick = setInterval(() => (now.value = Date.now()), 1000)))
  onBeforeUnmount(() => clearInterval(tick))

  const seconds = computed(() => Math.max(0, Math.ceil((until.value - now.value) / 1000)))
  const label = computed(() => `${Math.floor(seconds.value / 60)}:${String(seconds.value % 60).padStart(2, '0')}`)

  return {
    seconds,
    label,
    /** Count down to an epoch-ms moment. */
    until: (moment: number) => {
      now.value = Date.now()
      until.value = moment
    },
  }
}
