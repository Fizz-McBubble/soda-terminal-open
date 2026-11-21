import { playerErrorMessage } from './playerErrorMessage'
import {
  getDevelopmentPriorityAgentIds,
  getSavedAgentBuildIds,
} from '../accounts/developmentPlanning'
import { loadCoreWarehouse, loadCoreWarehouseForAccount } from '../accounts/coreWarehouse'
import { listAccountPlanningDrafts } from '../accounts/planningDraftReads'
import { getTeamPortfolioPreference } from '../accounts/teamPortfolioPreference'
import type { AccountProfile } from '../accounts/types'
import {
  type AccountDecisionAuthoritySummary,
  type AccountDecisionQueryInput,
  type AccountDecisionRun,
  type CalculationQueryClient,
  type DecisionClaimStatus,
} from './calculationQueryContract'
import { createAccountDecisionRun } from './publicAccountDecisionRun'
export { createAccountDecisionRun } from './publicAccountDecisionRun'
// `import type` is fully erased; an inline `{ type X }` specifier survives as an empty side-effect
// import and would pull the private runtime-selection module into the public browser bundle.
import type { CurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'

export type AccountDecisionWorldInput = AccountDecisionQueryInput

export type AccountDecisionNextAction = {
  label: string
  title: string
  description: string
  path: '/loadouts/team' | '/warehouse/discs'
}

export type AccountDecisionWorld =
  | { status: 'loading'; run: null; liveFingerprint: null; nextAction: null }
  | { status: 'unavailable'; run: null; liveFingerprint: null; nextAction: null }
  | {
      status: 'error'
      run: null
      liveFingerprint: null
      nextAction: null
      message: string
      canRepairApplicationData: boolean
    }
  | {
      status: 'current' | 'stale'
      run: AccountDecisionRun
      liveFingerprint: string
      nextAction: AccountDecisionNextAction
    }

export type AccountDecisionWorldContextValue = AccountDecisionWorld & {
  refresh: () => Promise<AccountDecisionRun | null>
  /** Explicit fixed-target recovery only; it never accepts or selects an external package. */
  repairApplicationData: () => Promise<AccountDecisionRun | null>
  /** Current account records stay available to directory views while a captured calculation is stale. */
  liveInput: AccountDecisionWorldInput | null | undefined
  /** A calculation failure is not evidence that account inputs changed. */
  analysisIssue?: {
    kind: 'runtime_unavailable' | 'calculation_failed' | 'run_lost'
    message: string
  } | null
  /** Observable work only; it does not estimate a completion percentage. */
  calculation?: {
    phase: 'reading_account' | 'preparing_rules' | 'analyzing'
    startedAt: number | null
  } | null
  calculationCancelled?: boolean
  cancelCalculation?: () => void
}

export type RuntimeSelectionReader = () => Promise<CurrentGameDataRuntimeSelection>

export type RuntimeSelectionObservation =
  | { status: 'ready'; selection: CurrentGameDataRuntimeSelection }
  | { status: 'error'; message: string }

export function readableCalculationError(error: unknown) {
  return playerErrorMessage(error, '当前分析暂时无法完成，请稍后重新分析。')
}

export function readableRuntimeSelectionError() {
  return '分析资料暂时无法读取，请重试。'
}

export async function observeRuntimeSelection(
  reader: RuntimeSelectionReader,
): Promise<RuntimeSelectionObservation> {
  try {
    return { status: 'ready', selection: await reader() }
  } catch {
    return { status: 'error', message: readableRuntimeSelectionError() }
  }
}

export async function loadWorldInput(
  activeAccount?: AccountProfile | null,
): Promise<AccountDecisionWorldInput | null> {
  const warehouse =
    activeAccount === undefined
      ? await loadCoreWarehouse()
      : await loadCoreWarehouseForAccount(activeAccount)
  if (!warehouse.accountId) return null
  const [drafts, activePlanIds, developmentPriorityAgentIds, preference] = await Promise.all([
    listAccountPlanningDrafts(warehouse.accountId),
    getSavedAgentBuildIds(warehouse.accountId),
    getDevelopmentPriorityAgentIds(warehouse.accountId),
    getTeamPortfolioPreference(warehouse.accountId),
  ])
  return { warehouse, drafts, activePlanIds, developmentPriorityAgentIds, preference }
}

export function accountDecisionNextAction(
  status: DecisionClaimStatus | 'stale',
  decisionAuthority: AccountDecisionAuthoritySummary,
): AccountDecisionNextAction {
  if (status === 'stale')
    return {
      label: '重新分析当前账户',
      title: '更新配装建议',
      description: '按最新角色和装备更新配装建议。',
      path: '/loadouts/team',
    }
  if (decisionAuthority.status === 'ready' && decisionAuthority.recommendationCount > 0)
    return {
      label: '查看队伍建议',
      title: '队伍建议已准备好',
      description: '结合已有角色与装备，查看适合先培养的队伍和需要调整的配装。',
      path: '/loadouts/team',
    }
  if (status === 'unsupported')
    return {
      label: '查看队伍配装',
      title: '选择队伍并配装',
      description: '选择想使用的代理人，按当前仓库搭配装备。',
      path: '/loadouts/team',
    }
  return {
    label: '查看队伍配装',
    title: '选择队伍并配装',
    description: '选择想使用的代理人，按当前仓库搭配装备。',
    path: '/loadouts/team',
  }
}

/** Live input changes make the captured run stale; only an explicit refresh creates a new run. */
export function retainOrCreateInitialAccountDecisionRun(
  current: AccountDecisionRun | null,
  input: AccountDecisionWorldInput,
  client: CalculationQueryClient,
) {
  return current?.input.warehouse.accountId === input.warehouse.accountId
    ? Promise.resolve(current)
    : createAccountDecisionRun(input, { client })
}
