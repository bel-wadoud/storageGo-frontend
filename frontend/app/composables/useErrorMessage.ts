import { ApiError } from '~/services/api/client'
import { CryptoError } from '~/services/crypto/types'

// Turns any error into one or two sentences: what happened and what to do next.
// Never a raw code on its own (accessibility.md, "Cognitive").
export function useErrorMessage() {
  const { t } = useI18n()

  function wait(seconds: number): string {
    return seconds < 60 ? t('time.seconds', { n: seconds }, seconds) : t('time.minutes', { n: Math.ceil(seconds / 60) }, Math.ceil(seconds / 60))
  }

  return function errorMessage(error: unknown): string {
    if (error instanceof ApiError) {
      switch (error.code) {
        case 'NETWORK':
          return t('errors.network')
        case 'TIMEOUT':
          return t('errors.timeout')
        case 'RATE_LIMITED':
          return error.retryAfter ? t('errors.rateLimitedFor', { time: wait(error.retryAfter) }) : t('errors.rateLimited')
        case 'INVALID_CREDENTIALS': {
          const left = Number(error.data?.attempts_left)
          const base = t('errors.invalidCredentials')
          return Number.isFinite(left) && left > 0 && left <= 3 ? `${base} ${t('errors.attemptsLeft', { n: left }, left)}` : base
        }
        case 'UNAUTHORIZED':
          return t('errors.sessionExpired')
        case 'CODE_INVALID':
          return t('errors.codeInvalid')
        case 'CODE_EXPIRED':
          return t('errors.codeExpired')
        case 'SIGNUP_EXPIRED':
          return t('errors.signupExpired')
        case 'GONE':
          return t('errors.gone')
        case 'VALIDATION':
          return t('errors.validation')
        case 'SERVER':
          return t('errors.server')
        default:
          return t('errors.unknown')
      }
    }
    if (error instanceof CryptoError) {
      if (error.code === 'SG_ERR_ENGINE') return t('errors.engine')
      if (error.code === 'SG_ERR_SELFTEST') return t('errors.selfTest')
      if (error.code === 'SG_ERR_KEY_CHANGED') return t('errors.keyChanged')
      return t('errors.crypto')
    }
    return t('errors.unknown')
  }
}
