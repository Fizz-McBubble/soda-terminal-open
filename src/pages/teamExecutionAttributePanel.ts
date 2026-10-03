import type { AccountRoster, RosterAgent } from '../assault/types'
import type { DriveDisc } from '../domain/schemas'
import type { TeamExecutionMember } from '../decision/teamExecutionProjection'
import { resolveWEngine, type ResolvedWEngine } from '../decision/wEngineResolver'
import { getAgentProfile, getProjectedBuildKnowledgeProfile } from '../gameDataPacks/agentProfile'
import { currentPanelData } from '../gameDataPacks/panel/currentPanelData'
import { getCurrentBuildTargetPanel } from '../gameDataPacks/currentBuildAuthority'
import { createAgentDevelopmentPanelProjection } from './agentDevelopmentPanelProjection'
import {
  evaluateSourceBoundAttackSupport,
  type SourceBoundAttackSupport,
} from '../calculation/sourceBoundAgentSupport'
import {
  characterPanelLabels,
  createAgentDevelopmentWorkbenchViewModel,
  targetPanelLowerBound,
} from './agentDevelopmentWorkbenchViewModel'

export type TeamExecutionAttributeCurrentStatus = 'exact' | 'baseline' | 'missing'
export type TeamExecutionAttributeTargetStatus = 'formal' | 'candidate' | 'missing'

export type TeamExecutionAttributeRow = {
  label: (typeof characterPanelLabels)[number]
  /** The account's currently equipped out-of-combat panel, when exactly reproducible. */
  outOfCombat: string
  /** The final out-of-combat value after applying the suggested six discs and W-Engine. */
  current: string
  /** The sourced contribution of the suggested six physical discs; never a final panel value. */
  contribution: string
  /** A quantitative target when the current profile actually contains one. */
  target: string
  outOfCombatStatus: TeamExecutionAttributeCurrentStatus
  currentStatus: TeamExecutionAttributeCurrentStatus
  targetStatus: TeamExecutionAttributeTargetStatus
  /** A sourced build-direction emphasis, not a graduation judgement. */
  isPriority: boolean
  /** True only for an exact current projection and a same-version quantitative target. */
  isBelowTarget: boolean
}

export type TeamExecutionAttributePanel = {
  attackSupport?: {
    current: SourceBoundAttackSupport
    suggested: SourceBoundAttackSupport
    delta: number | null
  }
  availability: 'available' | 'partial' | 'unavailable'
  rows: readonly TeamExecutionAttributeRow[]
  source: {
    outOfCombat: {
      status: TeamExecutionAttributeCurrentStatus
      panelVersion: string
      gameVersion: string | null
      discIds: readonly string[]
      wEngineId: string | null
      reason: string | null
    }
    current: {
      status: TeamExecutionAttributeCurrentStatus
      panelVersion: string
      gameVersion: string | null
      discIds: readonly string[]
      wEngineId: string | null
      reason: string | null
    }
    target: {
      fieldPath: 'build.target_panel'
      conditions?: readonly string[]
      status: TeamExecutionAttributeTargetStatus
      gameVersion: string | null
      sourceIds: readonly string[]
    }
    recommendation: {
      available: boolean
      sourceIds: readonly string[]
    }
  }
  copy: {
    heading: string
    current: string
    target: string
  }
}

const panelKeys = {
  生命值: 'hp',
  攻击力: 'atk',
  防御力: 'def',
  冲击力: 'impact',
  暴击率: 'critRate',
  暴击伤害: 'critDamage',
  异常掌控: 'anomalyMastery',
  异常精通: 'anomalyProficiency',
  穿透率: 'penRatio',
  能量自动回复: 'energyRegen',
} as const

const priorityTerms = {
  生命值: ['生命', 'hp'],
  攻击力: ['攻击', 'attack', 'atk'],
  防御力: ['防御', 'def'],
  冲击力: ['冲击', 'impact'],
  暴击率: ['暴击率', 'crit rate', 'crit_rate'],
  暴击伤害: ['暴击伤害', 'crit damage', 'crit_dmg'],
  异常掌控: ['异常掌控', 'anomaly mastery', 'anomaly_mastery'],
  异常精通: ['异常精通', 'anomaly proficiency', 'anomaly_proficiency'],
  穿透率: ['穿透', 'pen'],
  能量自动回复: ['能量', 'energy regen', 'energy_regen'],
} as const

function sourceStatus(status: string | undefined): TeamExecutionAttributeTargetStatus {
  return status === 'formal' ? 'formal' : status === 'missing' || !status ? 'missing' : 'candidate'
}

function currentGameVersion() {
  return currentPanelData.version.match(/^(\d+\.\d+)/)?.[1] ?? null
}

type WEngineFact = Pick<ResolvedWEngine, 'engineId' | 'level' | 'refinement'>

/**
 * Team Execution records the confirmed refinement as part of its suggested
 * equipment parameter. Its plan contract currently fixes the W-Engine level
 * at 60, so it must not inherit a different level from the current account
 * copy when rebuilding the suggested out-of-combat panel.
 */
export function resolveSuggestedWEngineParameters(
  suggested: TeamExecutionMember['suggested']['wEngine'],
  recommendedPrimary: WEngineFact | null,
): WEngineFact | null {
  if (!suggested) return recommendedPrimary
  return {
    engineId: suggested.engineId,
    level: 60,
    refinement: suggested.refinement,
  }
}

function displayTargetConditions(conditions: readonly string[]) {
  return conditions
    .map((condition) => {
      const trimmed = condition.trim()
      return trimmed.replace(/[。；;]+$/u, '') || trimmed
    })
    .join('；')
}

function agentWithWEngine(agent: RosterAgent, engine: WEngineFact | null): RosterAgent {
  if (!engine) return agent
  return {
    ...agent,
    wEngineDetails: {
      ...agent.wEngineDetails,
      id: engine.engineId,
      level: engine.level,
      refinement: engine.refinement,
    },
  }
}

function isBaselineProjection(agent: RosterAgent, engine: WEngineFact | null) {
  const progressionIsBaseline =
    agent.source === 'manual' &&
    agent.progressionManuallySet !== true &&
    agent.manualSource !== 'manual_override'
  const engineIsBaseline = Boolean(engine) && agent.manualSource === 'manual_initial_default'
  return progressionIsBaseline || engineIsBaseline
}

function hasPriority(direction: readonly string[], label: (typeof characterPanelLabels)[number]) {
  const terms = priorityTerms[label]
  return direction.some((item) => {
    const normalized = item.toLocaleLowerCase()
    return terms.some((term) => normalized.includes(term.toLocaleLowerCase()))
  })
}

/**
 * Projects the member's *suggested* Team Execution combination. It intentionally
 * does not consume the page presentation model or estimate a target panel.
 */
export function createTeamExecutionAttributePanel(input: {
  agent: RosterAgent
  member: TeamExecutionMember
  discs: readonly DriveDisc[]
  wEngines?: AccountRoster['wEngines']
  memberIds?: readonly string[]
}): TeamExecutionAttributePanel {
  const profile = getProjectedBuildKnowledgeProfile(input.agent.agentId)
  const agentProfile = getAgentProfile(input.agent.agentId)
  const targetField = getCurrentBuildTargetPanel(input.agent.agentId)
  const targetStatus = sourceStatus(targetField?.status)
  const suggested = input.member.suggested
  const wEngineResolution = resolveWEngine({
    agent: input.agent,
    legacyWEngines: input.wEngines,
    recommendedWEngineIds: suggested.wEngine ? [suggested.wEngine.engineId] : undefined,
  })
  const currentEngine = wEngineResolution.current
  const currentProjectionAgent = agentWithWEngine(input.agent, currentEngine)
  const outOfCombatPanel = createAgentDevelopmentPanelProjection({
    agent: currentProjectionAgent,
    discs: [...input.discs],
    planDiscIds: input.member.current.discIds,
  }).result
  const outOfCombatWorkbench = createAgentDevelopmentWorkbenchViewModel({
    agent: input.agent,
    profile,
    activePlan: {
      name: 'Team Execution current out-of-combat',
      warehouseRefs: [...input.member.current.discIds],
    },
    discs: [...input.discs],
    targetPanel: targetField ? { value: targetField.value, status: targetField.status } : null,
    panel: outOfCombatPanel,
  })
  const engine = resolveSuggestedWEngineParameters(
    suggested.wEngine,
    wEngineResolution.recommendedPrimary,
  )
  const hasSupportedEngine = Boolean(engine && currentPanelData.wEngines[engine.engineId])
  const projectedAgent: RosterAgent = {
    ...agentWithWEngine(input.agent, hasSupportedEngine && engine ? engine : null),
    wEngineCopyId: null,
    wEngineDetails:
      hasSupportedEngine && engine
        ? {
            ...input.agent.wEngineDetails,
            id: engine.engineId,
            level: engine.level,
            refinement: engine.refinement,
          }
        : { id: null, name: null, level: null, refinement: null },
  }
  const panel = createAgentDevelopmentPanelProjection({
    agent: projectedAgent,
    discs: [...input.discs],
    planDiscIds: suggested.discIds,
  }).result
  const workbench = createAgentDevelopmentWorkbenchViewModel({
    agent: projectedAgent,
    profile,
    activePlan: { name: 'Team Execution suggested', warehouseRefs: [...suggested.discIds] },
    discs: [...input.discs],
    targetPanel: targetField ? { value: targetField.value, status: targetField.status } : null,
    panel,
  })
  const currentStatus: TeamExecutionAttributeCurrentStatus =
    panel.status === 'ok' ? 'exact' : 'missing'
  const outOfCombatStatus: TeamExecutionAttributeCurrentStatus =
    outOfCombatPanel.status === 'ok'
      ? isBaselineProjection(input.agent, currentEngine)
        ? 'baseline'
        : 'exact'
      : 'missing'
  const exactGameVersion = currentGameVersion()
  // Free-text conditions are visible evidence, not proof this account satisfies them.
  const comparable =
    currentStatus === 'exact' && targetField !== null && !targetField.conditions.length
  const priority = profile.recommendation?.subStats ?? []
  const rows = characterPanelLabels.map((label, index) => {
    const fact = workbench.facts[index]!
    const outOfCombatFact = outOfCombatWorkbench.facts[index]!
    const target = targetPanelLowerBound(
      targetField ? { value: targetField.value, status: targetField.status } : null,
      label,
    )
    const current = panel.status === 'ok' ? panel.values[panelKeys[label]] : null
    return {
      label,
      outOfCombat: outOfCombatPanel.status === 'ok' ? outOfCombatFact.current : '资料不足',
      current: current === null ? '资料不足' : fact.current,
      contribution: fact.contribution,
      target: fact.target,
      outOfCombatStatus,
      currentStatus,
      targetStatus: fact.targetEvidence === 'missing' ? 'missing' : targetStatus,
      isPriority: hasPriority(priority, label),
      isBelowTarget: comparable && current !== null && target !== null && current < target,
    } satisfies TeamExecutionAttributeRow
  })
  const recommendationSourceIds = [
    ...new Set(
      agentProfile.fields
        .filter((field) => field.path === 'build.main_sub_stats')
        .flatMap((field) => field.sourceRefs.map((source) => source.id)),
    ),
  ]
  const availability =
    currentStatus === 'exact' && rows.some((row) => row.targetStatus !== 'missing')
      ? 'available'
      : outOfCombatStatus === 'exact' ||
          currentStatus === 'exact' ||
          priority.length ||
          rows.some((row) => row.contribution !== '无可证副词条')
        ? 'partial'
        : 'unavailable'
  const currentCopy =
    currentStatus === 'exact'
      ? '当前求解方案的角色、建议音擎与六张实体盘已复算为局外面板。'
      : `当前求解方案暂不能复算最终面板：${panel.status === 'unsupported' ? panel.reason : '缺少可用输入。'}`
  const targetCopy = rows.some((row) => row.targetStatus !== 'missing')
    ? comparable
      ? '毕业参考与当前局外面板属于同一版本；仅量化字段会标出低于参考。'
      : targetField?.conditions.length
        ? `参考条件：${displayTargetConditions(targetField.conditions)}。条件尚未逐项核对，不标记差距。`
        : '毕业参考已来源化，但当前局外面板版本无法证明可比；不标记差距。'
    : priority.length
      ? '暂无同版本量化毕业参考；保留来源化重点属性方向，不对毕业状态作判断。'
      : '暂无同版本量化毕业参考或重点属性方向。'
  return {
    availability,
    rows,
    ...(input.agent.agentId === 'agent-remielle' && input.memberIds
      ? (() => {
          const current = evaluateSourceBoundAttackSupport({
            memberIds: input.memberIds,
            initialAttack: outOfCombatStatus === 'exact' ? outOfCombatPanel.values.atk : null,
          })
          const suggested = evaluateSourceBoundAttackSupport({
            memberIds: input.memberIds,
            initialAttack: currentStatus === 'exact' ? panel.values.atk : null,
          })
          return {
            attackSupport: {
              current,
              suggested,
              delta:
                current.status === 'supported' && suggested.status === 'supported'
                  ? suggested.value! - current.value!
                  : null,
            },
          }
        })()
      : {}),
    source: {
      outOfCombat: {
        status: outOfCombatStatus,
        panelVersion: currentPanelData.version,
        gameVersion: exactGameVersion,
        discIds: [...input.member.current.discIds],
        wEngineId: currentEngine?.engineId ?? null,
        reason:
          outOfCombatPanel.status === 'unsupported' ? (outOfCombatPanel.reason ?? null) : null,
      },
      current: {
        status: currentStatus,
        panelVersion: currentPanelData.version,
        gameVersion: exactGameVersion,
        discIds: [...suggested.discIds],
        wEngineId: suggested.wEngine?.engineId ?? null,
        reason: panel.status === 'unsupported' ? (panel.reason ?? null) : null,
      },
      target: {
        fieldPath: 'build.target_panel',
        conditions: targetField?.conditions ?? [],
        status: targetStatus,
        gameVersion: targetField?.gameVersion ?? null,
        sourceIds: targetField?.sourceRefs.map((source) => source.id) ?? [],
      },
      recommendation: { available: Boolean(priority.length), sourceIds: recommendationSourceIds },
    },
    copy: { heading: '角色详细属性', current: currentCopy, target: targetCopy },
  }
}
