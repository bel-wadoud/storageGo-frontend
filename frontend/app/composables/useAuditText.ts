import type { AuditEvent } from '~/services/api/admin'

// How an audit event reads, the same on the overview and in the log. The server records
// ids, never names or content (it doesn't have them), and the copy says so.
// Policy settings by the name the audit log records them under.
const POLICY_LABELS: Record<string, string> = {
  links_allowed: 'admin.policies.sharing.links',
  max_link_days: 'admin.policies.sharing.maxDays',
  link_password_required: 'admin.policies.sharing.password',
  requests_allowed: 'admin.policies.sharing.requests',
  device_approval: 'admin.policies.devices.title',
  session_hours: 'admin.policies.sessions.length',
  idle_lock_minutes: 'admin.policies.sessions.idle',
  org_recovery: 'admin.policies.recovery.on',
  recovery_approvals: 'admin.policies.recovery.approvals',
  kit_required: 'admin.policies.recovery.kit',
  trash_days: 'admin.policies.trash.keep',
}

export function useAuditText() {
  const { t } = useI18n()

  function action(event: AuditEvent): string {
    return t(`admin.audit.actions.${event.action}`)
  }

  function actor(event: AuditEvent): string {
    return event.actor ? event.actor.name || event.actor.email : t('admin.audit.someoneOutside')
  }

  function target(event: AuditEvent): string {
    const subject = event.target
    if (!subject) return ''
    if (subject.kind === 'member') return subject.person.name || subject.person.email
    if (subject.kind === 'policy') {
      return subject.id
        .split(',')
        .map((key) => (POLICY_LABELS[key] ? t(POLICY_LABELS[key]!) : key))
        .join(', ')
    }
    return t(`admin.audit.targets.${subject.kind}`, { id: subject.id.slice(0, 10) })
  }

  return { action, actor, target }
}
