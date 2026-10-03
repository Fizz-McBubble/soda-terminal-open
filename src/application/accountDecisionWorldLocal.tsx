/* eslint-disable react-refresh/only-export-components -- local composition preserves provider and helper defaults */
import {
  AccountDecisionWorldProvider as CoreAccountDecisionWorldProvider,
  type AccountDecisionWorldProviderProps,
} from './accountDecisionWorld'
import {
  createAccountDecisionRun as createCoreAccountDecisionRun,
  retainOrCreateInitialAccountDecisionRun as retainOrCreateCoreAccountDecisionRun,
  type AccountDecisionWorldInput,
} from './accountDecisionWorldModel'
import type { AccountDecisionRun, CalculationQueryClient } from './calculationQueryContract'
import { localCalculationQueryClient } from './localCalculationQueryClient'
import { readCurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import { repairBundledCurrentGameData } from '../gameDataPacks/repository'

export function AccountDecisionWorldProvider({
  queryClient = localCalculationQueryClient,
  runtimeSelectionReader = readCurrentGameDataRuntimeSelection,
  repairRuntimeSelection = repairBundledCurrentGameData,
  ...props
}: Omit<
  AccountDecisionWorldProviderProps,
  'queryClient' | 'runtimeSelectionReader' | 'repairRuntimeSelection'
> &
  Partial<
    Pick<
      AccountDecisionWorldProviderProps,
      'queryClient' | 'runtimeSelectionReader' | 'repairRuntimeSelection'
    >
  >) {
  return (
    <CoreAccountDecisionWorldProvider
      {...props}
      queryClient={queryClient}
      runtimeSelectionReader={runtimeSelectionReader}
      repairRuntimeSelection={repairRuntimeSelection}
    />
  )
}

export function createAccountDecisionRun(
  input: AccountDecisionWorldInput,
  options: { runId?: string; capturedAt?: string; client?: CalculationQueryClient } = {},
) {
  return createCoreAccountDecisionRun(input, {
    ...options,
    client: options.client ?? localCalculationQueryClient,
  })
}

export function retainOrCreateInitialAccountDecisionRun(
  current: AccountDecisionRun | null,
  input: AccountDecisionWorldInput,
  client: CalculationQueryClient = localCalculationQueryClient,
) {
  return retainOrCreateCoreAccountDecisionRun(current, input, client)
}
