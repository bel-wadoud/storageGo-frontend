// The admin console is for an organization's administrators (sitemap §5). Runs after `auth`.
// Anyone else is sent back to their files with the reason, never to a blank or broken page.
export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return
  const { account } = useAccount()
  if (!account.value) return
  const drive = useDrive()
  // Plain statements (no await inside expressions): Nuxt rewrites awaits in middleware.
  let allowed = false
  try {
    await drive.init()
    allowed = drive.workspaces.value.some((w) => w.kind === 'org' && w.admin)
  } catch {
    // Can't tell right now: let the page load and show its own error with a retry.
    return
  }
  if (allowed) return
  const nuxtApp = useNuxtApp()
  useToast().info(String(nuxtApp.$i18n.t(account.value.kind === 'org' ? 'admin.onlyAdmins' : 'admin.onlyOrgs')))
  return navigateTo('/drive', { replace: true })
})
