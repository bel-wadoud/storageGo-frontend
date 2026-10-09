export type ToastTone = 'success' | 'error' | 'warning' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void | Promise<void>
}

export interface Toast {
  id: number
  tone: ToastTone
  message: string
  action?: ToastAction
  /** Milliseconds before it disappears; 0 keeps it until dismissed. */
  duration: number
}

export interface ToastOptions {
  action?: ToastAction
  duration?: number
}

const MAX_VISIBLE = 4
// Errors and toasts with an action stay longer: the user needs time to read and react.
const DEFAULT_DURATION: Record<ToastTone, number> = { success: 5000, info: 5000, warning: 8000, error: 10000 }

export function useToast() {
  const toasts = useState<Toast[]>('sg-toasts', () => [])
  const nextId = useState('sg-toast-next-id', () => 1)

  function show(tone: ToastTone, message: string, options: ToastOptions = {}): number {
    const id = nextId.value++
    const duration = options.duration ?? (options.action ? Math.max(DEFAULT_DURATION[tone], 8000) : DEFAULT_DURATION[tone])
    toasts.value = [...toasts.value, { id, tone, message, action: options.action, duration }].slice(-MAX_VISIBLE)
    return id
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return {
    toasts,
    dismiss,
    success: (message: string, options?: ToastOptions) => show('success', message, options),
    error: (message: string, options?: ToastOptions) => show('error', message, options),
    warning: (message: string, options?: ToastOptions) => show('warning', message, options),
    info: (message: string, options?: ToastOptions) => show('info', message, options),
  }
}
