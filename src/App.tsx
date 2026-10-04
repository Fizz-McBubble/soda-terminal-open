import { useMemo } from 'react'
import AppCore, { type DecisionEnvironment } from './AppCore'
import { AppHealthProvider } from './appHealth'
import type { initializeDatabase } from './db/database'
import { localCalculationQueryClient } from './application/localCalculationQueryClient'
import { createRemoteCalculationQueryClient } from './application/remoteCalculationQueryClient'
import { readCurrentGameDataRuntimeSelection } from './gameDataPacks/runtimeSelection'
import { repairBundledCurrentGameData } from './gameDataPacks/repository'

/** Local desktop composition and the existing isolated public-mode test adapter. */
export default function App({
  databaseInitializer,
}: {
  databaseInitializer?: typeof initializeDatabase
} = {}) {
  const onlineMode = import.meta.env.VITE_SODA_PUBLIC_BUILD === 'true'
  const decisionEnvironment = useMemo<DecisionEnvironment>(
    () => ({
      mode: onlineMode ? 'remote' : 'local',
      queryClient: onlineMode
        ? createRemoteCalculationQueryClient({
            readRuntimeSelection: readCurrentGameDataRuntimeSelection,
          })
        : localCalculationQueryClient,
      runtimeSelectionReader: readCurrentGameDataRuntimeSelection,
      repairRuntimeSelection: onlineMode ? null : repairBundledCurrentGameData,
    }),
    [onlineMode],
  )
  return (
    <AppCore
      databaseInitializer={databaseInitializer}
      decisionEnvironment={decisionEnvironment}
      HealthProvider={AppHealthProvider}
    />
  )
}
