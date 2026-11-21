import type { ReactNode } from 'react'

// jsdom has no native Popover API; real-browser checks cover positioning and dismissal.
export function ExplanationPopover({
  label,
  triggerAriaLabel,
  children,
}: {
  label: string
  triggerAriaLabel?: string
  children: ReactNode
}) {
  return (
    <details>
      <summary aria-label={triggerAriaLabel}>{label}</summary>
      {children}
    </details>
  )
}
