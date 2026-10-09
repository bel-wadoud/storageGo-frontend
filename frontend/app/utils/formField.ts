import type { ComputedRef, InjectionKey } from 'vue'

// What <SgField> shares with the control inside it, so label, hint and error are wired up
// (for=, aria-describedby, aria-invalid) without the page having to pass ids around.
export interface FieldContext {
  id: string
  describedBy: ComputedRef<string | undefined>
  invalid: ComputedRef<boolean>
  required: ComputedRef<boolean>
}

export const fieldKey: InjectionKey<FieldContext> = Symbol('sg-field')
