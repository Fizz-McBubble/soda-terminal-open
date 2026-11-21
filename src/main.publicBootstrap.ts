import { createElement, StrictMode, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { schedulePublicOfflineShell } from './offline/schedulePublicOfflineShell'
import { applyRouteStyleScope, waitForRouteStyleScope } from './styles/routeStyles'
import { showStartupRecovery } from './startupRecovery'

export type BootstrapPublicAppOptions = {
  timeoutMs?: number
  onRecovery?: (stage: 'application' | 'styles', retry: () => void) => void
  mountApp?: (App: ComponentType) => void
}

let activeBootstrapAttempt = 0

export function resetBootstrapStateForTesting() {
  activeBootstrapAttempt = 0
}

export function mountPublicApp(
  App: ComponentType,
  options: { afterMount?: () => void | Promise<void> } = {},
) {
  const scope = applyRouteStyleScope(window.location.pathname)
  void waitForRouteStyleScope(scope).then(
    async () => {
      createRoot(document.getElementById('root')!).render(
        createElement(StrictMode, null, createElement(App)),
      )
      await (options.afterMount ?? schedulePublicOfflineShell)()
    },
    () => showStartupRecovery('styles'),
  )
}

/**
 * Boots the public application with a bounded startup deadline, in-place retry,
 * and suppression of late module resolution to prevent mounting over recovery cards.
 */
export function bootstrapPublicApp(
  loader: () => Promise<{ default: ComponentType }>,
  options: BootstrapPublicAppOptions = {},
): () => void {
  const timeoutMs = options.timeoutMs ?? 15_000
  const onRecovery = options.onRecovery ?? showStartupRecovery
  const mount = options.mountApp ?? mountPublicApp

  activeBootstrapAttempt += 1
  const attempt = activeBootstrapAttempt
  let settled = false

  const retry = () => {
    if (activeBootstrapAttempt !== attempt) return
    bootstrapPublicApp(loader, options)
  }

  const timer = setTimeout(() => {
    if (settled || activeBootstrapAttempt !== attempt) return
    settled = true
    onRecovery('application', retry)
  }, timeoutMs)

  loader().then(
    ({ default: App }) => {
      if (settled || activeBootstrapAttempt !== attempt) {
        // Late resolve: suppress mounting after deadline or supersession
        return
      }
      settled = true
      clearTimeout(timer)
      mount(App)
    },
    (error: unknown) => {
      if (settled || activeBootstrapAttempt !== attempt) {
        // Late rejection: suppress
        return
      }
      settled = true
      clearTimeout(timer)
      if (import.meta.env.DEV) console.error('Soda application module failed to load.', error)
      onRecovery('application', retry)
    },
  )

  return () => {
    if (activeBootstrapAttempt === attempt) {
      settled = true
      clearTimeout(timer)
    }
  }
}
