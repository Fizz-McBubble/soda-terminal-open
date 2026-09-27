import { createDefaultAccountDecisionSnapshotCalculator } from './browserAccountDecisionWorker'
import type { AccountDecisionSnapshotCalculator } from './browserAccountDecisionWorker'
import { readCurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import type { CurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import type { CalculationQueryClient } from './calculationQueryContract'
import { createLocalCalculationQueryClientCore } from './localCalculationQueryClientCore'

/** Desktop composition retains its existing snapshot Worker and public local-client contract. */
export function createLocalCalculationQueryClient(
  options: {
    readRuntimeSelection?: () => Promise<CurrentGameDataRuntimeSelection>
    calculateSnapshot?: AccountDecisionSnapshotCalculator
  } = {},
): CalculationQueryClient {
  return createLocalCalculationQueryClientCore({
    readRuntimeSelection: options.readRuntimeSelection ?? readCurrentGameDataRuntimeSelection,
    calculateSnapshot:
      options.calculateSnapshot ?? createDefaultAccountDecisionSnapshotCalculator().calculateSnapshot,
  })
}

export const localCalculationQueryClient = createLocalCalculationQueryClient()
