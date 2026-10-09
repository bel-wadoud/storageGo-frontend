import type { Ref } from 'vue'

// Progress through a multi-step flow (signup, sign-in), kept in this tab's sessionStorage so a
// reload or an accidental back doesn't lose it. Only non-secret data belongs here: never a
// passphrase, a recovery phrase or a key. Gone when the tab closes, removed when reset.
const restored = new Set<string>()

export function useSessionDraft<T extends object>(key: string, empty: () => T): { draft: Ref<T>; clear: () => void } {
  const draft = useState<T>(`draft:${key}`, empty)

  if (import.meta.client && !restored.has(key)) {
    restored.add(key)
    try {
      const saved = sessionStorage.getItem(key)
      if (saved) draft.value = { ...empty(), ...(JSON.parse(saved) as Partial<T>) }
    } catch {
      // Storage blocked (private mode, policy): the flow still works, it just won't survive a reload.
    }
    // Detached scope: the watcher must outlive the page that first used the draft.
    effectScope(true).run(() =>
      watch(
        draft,
        (value) => {
          try {
            const text = JSON.stringify(value)
            // Nothing in progress (never started, or finished and reset): leave nothing behind.
            if (text === JSON.stringify(empty())) sessionStorage.removeItem(key)
            else sessionStorage.setItem(key, text)
          } catch {
            // See above.
          }
        },
        { deep: true },
      ),
    )
  }

  return {
    draft,
    clear: () => {
      draft.value = empty()
    },
  }
}
