import type { ReactNode } from 'react'

// jsdom has no native Popover API; real-browser checks cover positioning and dismissal.
export function ExplanationPopover({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details>
      <summary>{label}</summary>
      {children}
    </details>
  )
}
