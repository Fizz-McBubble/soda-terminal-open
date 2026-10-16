import { createElement, StrictMode, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { schedulePublicOfflineShell } from './offline/schedulePublicOfflineShell'
import { applyRouteStyleScope, waitForRouteStyleScope } from './styles/routeStyles'
import { showStartupRecovery } from './startupRecovery'

export function mountPublicApp(App: ComponentType) {
  const scope = applyRouteStyleScope(window.location.pathname)
  void waitForRouteStyleScope(scope).then(
    () => {
      createRoot(document.getElementById('root')!).render(
        createElement(StrictMode, null, createElement(App)),
      )
      schedulePublicOfflineShell()
    },
    () => showStartupRecovery('styles'),
  )
}
