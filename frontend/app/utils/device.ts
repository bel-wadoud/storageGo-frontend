// A readable name for this browser ("Chrome on Windows"), shown on the user's other devices
// when they approve it. Only a label: nothing security-related depends on it.
export function deviceName(userAgent: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): string {
  const browser =
    (/Edg\//.test(userAgent) && 'Edge') ||
    (/OPR\/|Opera/.test(userAgent) && 'Opera') ||
    (/Firefox\//.test(userAgent) && 'Firefox') ||
    (/Chrome\//.test(userAgent) && 'Chrome') ||
    (/Safari\//.test(userAgent) && 'Safari') ||
    'Browser'
  const system =
    (/Windows/.test(userAgent) && 'Windows') ||
    (/Android/.test(userAgent) && 'Android') ||
    (/iPhone|iPad|iPod/.test(userAgent) && 'iOS') ||
    (/Mac OS X/.test(userAgent) && 'macOS') ||
    (/CrOS/.test(userAgent) && 'ChromeOS') ||
    (/Linux/.test(userAgent) && 'Linux') ||
    ''
  return system ? `${browser} on ${system}` : browser
}
