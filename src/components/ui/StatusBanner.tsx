import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertTriangle,
  stale: RefreshCw,
} as const

export function StatusBanner({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof icons
  title: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  const Icon = icons[tone]
  const alert = tone === 'error'
  return (
    <section
      aria-live={alert ? undefined : 'polite'}
      className={clsx('sea-status-banner', `sea-status-banner--${tone}`, className)}
      role={alert ? 'alert' : 'status'}
    >
      <Icon aria-hidden="true" size={20} />
      <div>
        <strong>{title}</strong>
        {children ? <div>{children}</div> : null}
      </div>
      {action ? <div className="sea-status-banner__action">{action}</div> : null}
    </section>
  )
}
