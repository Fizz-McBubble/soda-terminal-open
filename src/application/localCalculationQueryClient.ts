import { createDefaultAccountDecisionSnapshotCalculator } from './browserAccountDecisionWorker'
import type { AccountDecisionSnapshotCalculator } from './browserAccountDecisionWorker'
import { readCurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import type { CurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import type { CalculationQueryClient } from './calculationQueryContract'
import { createLocalCalculationQueryClientCore } from './localCalculationQueryClientCore'
import { createBrowserCalculationQueryClient } from './browserCalculationQueryClient'

/** Explicit in-process composition for non-browser hosts and isolated adapters. */
export function createLocalCalculationQueryClient(
  options: {
    readRuntimeSelection?: () => Promise<CurrentGameDataRuntimeSelection>
    calculateSnapshot?: AccountDecisionSnapshotCalculator
  } = {},
): CalculationQueryClient {
  return createLocalCalculationQueryClientCore({
    readRuntimeSelection: options.readRuntimeSelection ?? readCurrentGameDataRuntimeSelection,
    calculateSnapshot:
      options.calculateSnapshot ??
      createDefaultAccountDecisionSnapshotCalculator().calculateSnapshot,
  })
}

// Use the existing whole-Query Worker in a browser. Standard-reference search must
// not freeze editing, account navigation or saved-plan recovery on the UI thread.
export const localCalculationQueryClient =
  typeof window !== 'undefined' && typeof Worker !== 'undefined'
    ? createBrowserCalculationQueryClient({
        readRuntimeSelection: readCurrentGameDataRuntimeSelection,
        resultProjection: 'local',
      })
    : createLocalCalculationQueryClient()
