import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { InstallerFeedbackPage } from './pages/InstallerFeedbackPage'
import { consumeInstallerFeedbackFragment } from './assetQuickRead/installerFeedback'

export function mountInstallerFeedbackIfRequested(): boolean {
  if (!/^\/installer-feedback\/?$/.test(window.location.pathname)) return false
  const report = consumeInstallerFeedbackFragment()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <InstallerFeedbackPage initialReport={report} />
    </StrictMode>,
  )
  return true
}
