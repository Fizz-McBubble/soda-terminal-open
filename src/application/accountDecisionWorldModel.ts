import { playerErrorMessage } from './playerErrorMessage'
import {
  getDevelopmentPriorityAgentIds,
  getSavedAgentBuildIds,
} from '../accounts/developmentPlanning'
import { loadCoreWarehouse } from '../accounts/coreWarehouse'
import { listAccountPlanningDrafts } from '../accounts/planningDrafts'
import { getTeamPortfolioPreference } from '../accounts/teamPortfolioPreference'
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
  return '无法读取游戏资料，请恢复与当前应用配套的资料后重新分析。'
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

export async function loadWorldInput(): Promise<AccountDecisionWorldInput | null> {
  const warehouse = await loadCoreWarehouse()
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
      title: '账户资料已有变化',
      description: '旧方案仍可查看；重新分析后，会按最新角色和装备更新建议。',
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
      label: '查看待补资料',
      title: '当前培养顺序尚未形成',
      description:
        decisionAuthority.status === 'blocked'
          ? decisionAuthority.blockers.join('；')
          : '现有资料还不足以给出完整队伍建议。',
      path: '/loadouts/team',
    }
  return {
    label: '查看待补资料',
    title: '当前培养顺序尚未形成',
    description: '当前还没有可执行的完整三人队伍建议。',
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
