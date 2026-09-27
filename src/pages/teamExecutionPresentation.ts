import { getAgentName } from '../application/publicRosterNames'
import { currentWEngineDirectory } from '../assault/planningCatalog'
import type { CoreWarehouse } from '../accounts/coreFlow'
import { driveDiscData } from '../data/gameData'
import type {
  TeamExecution,
  TeamExecutionAction,
  TeamExecutionImpact,
  TeamExecutionMember,
  TeamExecutionPortfolio,
} from '../decision/teamExecutionProjection'
import type { DiscFact } from '../features/agentDevelopmentGolden/types'
import type { AccountLoadout } from '../optimizer/optimizeAccountBuilds'
import { readablePhysicalDiscLabel } from './WarehouseManualDecisionLayer'
import { orderTeamMembers } from '../decision/teamDeployment'
import {
  displayDriveDiscSet,
  formatDiscStatValue,
  presentDiscFactFromChoice,
} from './discFactPresentation'
import type { DriveDisc } from '../domain/schemas'
import { displayDiscMainValueWithRules } from './publicDiscFacts'
import {
  incompleteTeamLoadoutMessage,
  isIncompleteTeamDiscReason,
  isSpecificTeamDiscReason,
  playerFacingExecutionBlocker as playerFacingExecutionBlockerWith,
  presentTeamExecutionPortfolio as presentTeamExecutionPortfolioWith,
} from './teamExecutionPortfolioPresentation'
export { incompleteTeamLoadoutMessage, isIncompleteTeamDiscReason, isSpecificTeamDiscReason }
export { formatDiscStatValue } from './discFactPresentation'
import { resolveWEngine } from '../decision/wEngineResolver'

export type TeamExecutionPlayerStatus = 'direct' | 'adjust' | 'confirm' | 'build'

export type TeamExecutionDiscState = 'keep' | 'change' | 'borrow' | 'recorded'

export type TeamExecutionDiscPresentation = DiscFact & {
  state: TeamExecutionDiscState
}

export type TeamExecutionMemberPresentation = {
  agentId: string
  agentName: string
  statusLabel: string
  actionLines: string[]
  currentWEngineId: string | null
  suggestedWEngineId: string | null
  currentWEngineLabel: string
  suggestedWEngineLabel: string
  wEngineFactLabel: string
  currentDiscIds: string[]
  currentDiscLabels: string[]
  discIds: string[]
  discLabels: string[]
  discFacts: TeamExecutionDiscPresentation[]
  /** Persisted suggested IDs that are absent from the current warehouse remain visible as a gap. */
  missingDiscIds: string[]
}

export type TeamExecutionPresentation = {
  status: TeamExecutionPlayerStatus
  statusLabel: '直接可用' | '需要调整' | '需要确认' | '配装未完成'
  headline: string
  primaryActions: string[]
  allActions: string[]
  impacts: string[]
  blockers: string[]
  scenarioLabel: string
  reuseLabel: string
  members: TeamExecutionMemberPresentation[]
}

export type TeamExecutionSummaryPresentation = Pick<
  TeamExecutionPresentation,
  'status' | 'statusLabel' | 'headline' | 'primaryActions' | 'allActions' | 'impacts'
>

const scenarioLabels: Readonly<Record<string, string>> = {
  single_target_boss: '单体首领',
  stun_window_burst: '失衡窗口爆发',
  ether_damage: '以太伤害',
  sheer_damage: '贯穿伤害',
  sustained_boss: '持续首领战',
  low_field_time_support: '低站场支援',
  high_pressure: '高压战斗',
  support_general: '通用支援',
  veil_attack: '帷幕强攻',
  physical_damage: '物理伤害',
  angels_anomaly: '妄想天使异常',
  abloom: '异放',
  polarity_abloom: '极性异放',
  ice_anomaly: '冰异常',
  chain_attack_burst: '连携爆发',
  multi_attribute_anomaly: '多属性异常',
}

function wEngineName(engineId: string | null | undefined) {
  if (!engineId) return '未录入音擎'
  return currentWEngineDirectory.find((engine) => engine.id === engineId)?.name ?? '音擎资料待补齐'
}

/** The desktop build keeps its own W-Engine directory wording in player-facing blocker text. */
const localBlockerNaming = {
  wEngineName: (engineId: string) => wEngineName(engineId),
}

function suggestedWEngineName(member: TeamExecutionMember) {
  return wEngineName(member.suggested.wEngine?.engineId)
}

export function displayDiscMainValue(disc: DriveDisc) {
  return displayDiscMainValueWithRules(disc, driveDiscData?.rules)
}

function hasCompleteCurrentDiscRecord(member: TeamExecutionMember) {
  return member.current.discIds.length === 6 && new Set(member.current.discIds).size === 6
}

function stateForDisc(member: TeamExecutionMember, discId: string): TeamExecutionDiscState {
  // A partial account record cannot establish a replacement diff. Keep the saved
  // scheme visible as a recorded loadout instead of calling every disc a change.
  if (!hasCompleteCurrentDiscRecord(member)) return 'recorded'
  if (member.current.discIds.includes(discId)) return 'keep'
  if (
    member.actions.some(
      (action) => action.kind === 'borrow_discs' && action.discIds.includes(discId),
    )
  )
    return 'borrow'
  return 'change'
}

function actionLine(action: TeamExecutionAction, member: TeamExecutionMember) {
  const agentName = getAgentName(action.agentId)
  switch (action.kind) {
    case 'keep_current_build':
      return `保持 ${agentName} 当前配装`
    case 'change_w_engine':
      return `为 ${agentName} 更换为 ${suggestedWEngineName(member)}`
    case 'change_discs':
      return `为 ${agentName} 更换 ${action.equipDiscIds.length} 张驱动盘`
    case 'borrow_w_engine':
      return `${agentName} 借用 ${getAgentName(action.fromAgentId)} 当前音擎`
    case 'borrow_discs':
      return `${agentName} 借用 ${action.fromAgentIds.map(getAgentName).join('、')} 的 ${action.discIds.length} 张驱动盘`
    case 'confirm_w_engine_fact':
      return `选择 ${agentName} 使用的音擎，并按需调整精炼（固定 60 级）`
    case 'missing_equipment':
      return `为 ${agentName} ${action.equipment === 'w_engine' ? '选择方案音擎' : '补齐六张驱动盘'}`
  }
}

function impactLine(impact: TeamExecutionImpact) {
  const equipment = impact.equipment === 'w_engine' ? '音擎' : '驱动盘'
  if (impact.kind === 'current_equipment')
    return `会暂时占用 ${impact.agentId ? getAgentName(impact.agentId) : '其他代理人'} 当前${equipment}`
  const plan = impact.planName ? `「${impact.planName}」` : '其他方案'
  return `与${impact.kind === 'active_plan' ? '当前方案' : '已保存方案'}${plan}共用${equipment}；保存本队不会改写该方案`
}

function uniqueImpactLines(impacts: TeamExecutionImpact[]) {
  const byIdentity = new Map<string, TeamExecutionImpact>()
  for (const [index, impact] of impacts.entries()) {
    // A saved plan can also be the active plan. Names are not identities: two
    // different plans with the same title must remain separately counted.
    const key =
      impact.kind === 'current_equipment'
        ? `current:${impact.agentId}:${impact.equipment}`
        : impact.planId
          ? `plan:${impact.planId}:${impact.equipment}`
          : `unknown:${index}`
    const previous = byIdentity.get(key)
    if (!previous || impact.kind === 'active_plan') byIdentity.set(key, impact)
  }
  const groups = new Map<string, TeamExecutionImpact[]>()
  for (const [identity, impact] of byIdentity) {
    const key =
      impact.kind !== 'current_equipment' && impact.planId && impact.planName
        ? `name:${impact.planName}:${impact.equipment}`
        : identity
    groups.set(key, [...(groups.get(key) ?? []), impact])
  }
  return [...groups.values()].map((group) => {
    const first = group[0]!
    if (group.length === 1) return impactLine(first)
    const equipment = first.equipment === 'w_engine' ? '音擎' : '驱动盘'
    return `与「${first.planName}」的 ${group.length} 份同名方案共用${equipment}；保存本队不会改写这些方案`
  })
}

function statusFor(execution: TeamExecution): TeamExecutionPlayerStatus {
  if (execution.status === 'missing_equipment') return 'build'
  if (execution.status === 'needs_confirmation') return 'confirm'
  return execution.members.every(
    (member) => member.actions.length === 1 && member.actions[0]?.kind === 'keep_current_build',
  )
    ? 'direct'
    : 'adjust'
}

export function presentTeamExecutionSummary(
  execution: TeamExecution,
): TeamExecutionSummaryPresentation {
  const status = statusFor(execution)
  const copy = statusCopy(status)
  const allActions = [
    ...new Set(
      execution.members.flatMap((member) =>
        member.actions.map((action) => actionLine(action, member)),
      ),
    ),
  ]
  const directActions = status === 'direct' ? ['保持三名成员当前配装，可直接出队'] : allActions
  return {
    status,
    statusLabel: copy.label,
    headline: copy.headline,
    primaryActions: directActions.slice(0, 3),
    allActions,
    impacts: uniqueImpactLines(execution.members.flatMap((member) => member.impacts)),
  }
}

function statusCopy(status: TeamExecutionPlayerStatus) {
  switch (status) {
    case 'direct':
      return {
        label: '直接可用' as const,
        headline: '三名成员可以保持当前配装，按这套队伍直接使用。',
      }
    case 'adjust':
      return {
        label: '需要调整' as const,
        headline: '成员与装备已配齐，按下面的换装操作后即可使用。',
      }
    case 'confirm':
      return {
        label: '需要确认' as const,
        headline: '请确认各成员使用的音擎，并按实际情况调整精炼等级。',
      }
    case 'build':
      return {
        label: '配装未完成' as const,
        headline: incompleteTeamLoadoutMessage,
      }
  }
}

function memberPresentation(
  member: TeamExecutionMember,
  warehouse: CoreWarehouse,
  allocation: readonly AccountLoadout[],
): TeamExecutionMemberPresentation {
  const currentAgent = warehouse.roster.agents.find((agent) => agent.agentId === member.agentId)
  const resolution = resolveWEngine({
    agent: currentAgent,
    legacyWEngines: warehouse.roster.wEngines,
    recommendedWEngineIds: member.suggested.wEngine
      ? [member.suggested.wEngine.engineId]
      : undefined,
  })
  const suggested = member.suggested.wEngine
  const allocationChoices = new Map(
    allocation
      .find((loadout) => loadout.agentId === member.agentId)
      ?.discs.map((choice) => [choice.disc.id, choice]) ?? [],
  )
  const referenceOwnersForDisc = (discId: string) => [
    ...new Map(
      member.impacts
        .filter(
          (impact) =>
            impact.equipment === 'drive_disc' &&
            impact.agentId !== null &&
            impact.agentId !== member.agentId &&
            impact.assetIds.includes(discId),
        )
        .map((impact) => [
          impact.agentId!,
          { agentId: impact.agentId!, name: getAgentName(impact.agentId!) },
        ]),
    ).values(),
  ]
  const discFacts = member.suggested.discIds.flatMap((discId) => {
    const disc = warehouse.discs.find((item) => item.id === discId)
    if (!disc) return []
    const fact = presentDiscFactFromChoice({
      agentId: member.agentId,
      choice: allocationChoices.get(disc.id) ?? null,
      disc,
      set: displayDriveDiscSet(disc.setId),
      mainValue: displayDiscMainValue(disc),
      formatSubStatValue: (stat, value) => formatDiscStatValue(stat, value, '+'),
    })
    return [
      {
        ...fact,
        conflicts: referenceOwnersForDisc(discId),
        state: stateForDisc(member, discId),
      } satisfies TeamExecutionDiscPresentation,
    ]
  })
  const missingDiscIds = member.suggested.discIds.filter(
    (discId) => !warehouse.discs.some((disc) => disc.id === discId),
  )
  return {
    agentId: member.agentId,
    agentName: getAgentName(member.agentId),
    statusLabel:
      member.status === 'ready'
        ? !hasCompleteCurrentDiscRecord(member)
          ? '配装已齐'
          : member.actions.some((action) => action.kind === 'keep_current_build')
            ? '保持当前配装'
            : '待换装'
        : member.status === 'needs_confirmation'
          ? '待确认音擎参数'
          : '配装未完成',
    actionLines: member.actions.map((action) => actionLine(action, member)),
    currentWEngineId: resolution.current?.engineId ?? null,
    suggestedWEngineId: suggested?.engineId ?? null,
    currentWEngineLabel: resolution.current?.name ?? '未记录音擎',
    suggestedWEngineLabel: wEngineName(suggested?.engineId),
    wEngineFactLabel:
      suggested?.fact === 'confirmed'
        ? `已选择 · 60 级 / 精炼${suggested.refinement}`
        : suggested
          ? `${suggested.fact === 'player_confirmed_parameter' ? '方案已确认' : '默认推荐'} · 60 级 / 精炼${suggested.refinement}`
          : '现有攻略暂未提供音擎推荐',
    currentDiscIds: [...member.current.discIds],
    currentDiscLabels: member.current.discIds.map((discId) => {
      const disc = warehouse.discs.find((item) => item.id === discId)
      return disc ? readablePhysicalDiscLabel(disc, warehouse.discs) : '找不到当前驱动盘的资料'
    }),
    discIds: [...member.suggested.discIds],
    discLabels: member.suggested.discIds.map((discId) => {
      const disc = warehouse.discs.find((item) => item.id === discId)
      return disc ? readablePhysicalDiscLabel(disc, warehouse.discs) : '找不到这张驱动盘的资料'
    }),
    discFacts,
    missingDiscIds,
  }
}

export function presentTeamExecution(
  execution: TeamExecution,
  warehouse: CoreWarehouse,
  allocation: readonly AccountLoadout[] = [],
): TeamExecutionPresentation {
  const summary = presentTeamExecutionSummary(execution)
  const members = orderTeamMembers(
    execution.members,
    (member) => member.agentId,
    execution.deploymentOrder,
  ).map((member) => memberPresentation(member, warehouse, allocation))
  return {
    ...summary,
    scenarioLabel: execution.scenario.tags.length
      ? execution.scenario.tags.map((tag) => scenarioLabels[tag] ?? '场景资料待补齐').join(' · ')
      : '场景资料待补齐',
    reuseLabel:
      execution.reusePolicy === 'simultaneous_lock'
        ? '多队同时出战时，驱动盘不能共用；音擎与邦布请按实际持有情况选择。'
        : '不同时间出战的队伍可以共用装备，请按换装建议切换。',
    blockers: [...new Set(execution.blockers.map(playerFacingExecutionBlocker))],
    members,
  }
}

export function presentTeamExecutionPortfolio(portfolio: TeamExecutionPortfolio) {
  return presentTeamExecutionPortfolioWith(portfolio, localBlockerNaming)
}

export function playerFacingExecutionBlocker(value: string) {
  return playerFacingExecutionBlockerWith(value, localBlockerNaming)
}
