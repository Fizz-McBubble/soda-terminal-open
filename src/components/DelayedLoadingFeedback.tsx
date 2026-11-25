import { useEffect, useState, type ReactNode } from 'react'

export function DelayedLoadingFeedback({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(true), 1200)
    return () => window.clearTimeout(timeout)
  }, [])
  return visible ? children : null
}
