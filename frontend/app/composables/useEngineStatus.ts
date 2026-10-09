// For pages that will need the crypto engine: checks the browser can run it, and starts
// loading it right away, while the user types, so the main button doesn't wait for the WASM.
export function useEngineStatus() {
  const errorMessage = useErrorMessage()
  const supported = ref(true)
  const state = ref<'loading' | 'ready' | 'failed'>('loading')
  const error = ref('')

  async function warmUp() {
    state.value = 'loading'
    error.value = ''
    try {
      await (await useCrypto()).ready()
      state.value = 'ready'
    } catch (cause) {
      state.value = 'failed'
      error.value = errorMessage(cause)
    }
  }

  onMounted(() => {
    supported.value = cryptoSupported()
    if (supported.value) warmUp()
  })

  return { supported, state, error, retry: warmUp }
}
