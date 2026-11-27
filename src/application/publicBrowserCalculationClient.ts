import { resolveActiveAccount } from '../accounts/accountSelectionDiagnostic'
import { createBrowserCalculationQueryClient } from './browserCalculationQueryClient'

export const publicBrowserCalculationClient = createBrowserCalculationQueryClient({
  readRuntimeSelection: async () =>
    (await import('../gameDataPacks/runtimeSelection')).readCurrentGameDataRuntimeSelection(),
  resultProjection: 'public-development',
})

export async function preparePublicCalculationForInitialRoute(pathname: string) {
  if ((await resolveActiveAccount()) && window.location.pathname === pathname)
    publicBrowserCalculationClient.prepareAccountDecision()
}
