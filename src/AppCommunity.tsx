import { useMemo } from 'react'
import AppCore, { type DecisionEnvironment } from './AppCore'
import { AppHealthProvider } from './appHealth'
import { createBrowserCalculationQueryClient } from './application/browserCalculationQueryClient'
import { readCurrentGameDataRuntimeSelection } from './gameDataPacks/runtimeSelection'

const repairBundledCurrentGameData = async () =>
  (await import('./gameDataPacks/repository')).repairBundledCurrentGameData()

/** The published browser product uses the accepted local algorithm through a Query Worker. */
export default function AppCommunity() {
  const decisionEnvironment = useMemo<DecisionEnvironment>(() => {
    const queryClient = createBrowserCalculationQueryClient({
      readRuntimeSelection: readCurrentGameDataRuntimeSelection,
      resultProjection: 'public-development',
    })
    return {
      mode: 'local',
      queryClient,
      prepareTeamDecision: queryClient.prepareAccountDecision,
      runtimeSelectionReader: readCurrentGameDataRuntimeSelection,
      repairRuntimeSelection: repairBundledCurrentGameData,
    }
  }, [])
  return <AppCore decisionEnvironment={decisionEnvironment} HealthProvider={AppHealthProvider} />
}
