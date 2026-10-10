import { adminApi, type ExportJob } from '~/services/api/admin'

// A file the server prepares (an audit export, the compliance pack): started, followed with
// its progress, then downloaded by itself when ready. Polling stops when the page goes away.
export function useExportJob() {
  const job = ref<ExportJob | null>(null)
  const failure = shallowRef<unknown>(null)
  const running = computed(() => job.value?.status === 'preparing')
  let timer: ReturnType<typeof setTimeout> | undefined
  let alive = true
  onBeforeUnmount(() => {
    alive = false
    clearTimeout(timer)
  })

  function download(ready: ExportJob) {
    if (!ready.url) return
    const anchor = document.createElement('a')
    anchor.href = ready.url
    anchor.download = ready.file_name
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  /** Starts a job and resolves once its file was handed to the browser (or it failed). */
  async function start(create: () => Promise<ExportJob>): Promise<ExportJob | null> {
    clearTimeout(timer)
    failure.value = null
    try {
      job.value = await create()
      while (alive && job.value.status === 'preparing') {
        await new Promise((resolve) => (timer = setTimeout(resolve, 900)))
        if (!alive) return null
        job.value = await adminApi.exportJob(job.value.id)
      }
      if (job.value.status === 'ready') download(job.value)
      return job.value
    } catch (error) {
      failure.value = error
      job.value = null
      return null
    }
  }

  return { job, failure, running, start, download }
}
