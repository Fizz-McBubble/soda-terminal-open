import type { RosterAgent } from '../assault/types'
import type { DriveDisc } from '../domain/schemas'
import { resolveRecordedAscension } from '../gameDataPacks/panel/wEngineGrowth'
import { hasCurrentWEngineProgression } from '../decision/wEngineResolver'
import { projectOutOfCombatMenuPanel, type PanelResult } from '../calculation/outOfCombatPanel'
import {
  getGraduationCandidateProfile,
  type RuntimeGraduationCandidateProfile,
} from '../gameDataPacks/graduationCandidateProfileProjection'
import {
  getL3AgentDevelopmentEvidence,
  type L3AgentDevelopmentEvidence,
} from '../gameDataPacks/l3ProductionProjection'

export type AgentDevelopmentPanelProjection = {
  source: '本次匹配方案' | '当前保存方案' | '当前已装备' | '暂无完整配装'
  result: PanelResult
  dataFoundation: L3AgentDevelopmentEvidence | null
  graduationCandidate: RuntimeGraduationCandidateProfile | null
}

function withLazyEvidence(
  agentId: string,
  projection: Pick<AgentDevelopmentPanelProjection, 'source' | 'result'>,
): AgentDevelopmentPanelProjection {
  let dataFoundationLoaded = false
  let dataFoundation: L3AgentDevelopmentEvidence | null = null
  let graduationCandidateLoaded = false
  let graduationCandidate: RuntimeGraduationCandidateProfile | null = null

  return {
    ...projection,
    // Route and panel-only consumers read `result`; evidence stays available on demand.
    get dataFoundation() {
      if (!dataFoundationLoaded) {
        dataFoundation = getL3AgentDevelopmentEvidence(agentId)
        dataFoundationLoaded = true
      }
      return dataFoundation
    },
    get graduationCandidate() {
      if (!graduationCandidateLoaded) {
        graduationCandidate = getGraduationCandidateProfile(agentId)
        graduationCandidateLoaded = true
      }
      return graduationCandidate
    },
  }
}

function unsupported(
  source: AgentDevelopmentPanelProjection['source'],
  reason: string,
  agentId: string,
): AgentDevelopmentPanelProjection {
  return withLazyEvidence(agentId, {
    source,
    result: {
      status: 'unsupported',
      values: {
        hp: 0,
        atk: 0,
        def: 0,
        impact: 0,
        critRate: 0,
        critDamage: 0,
        lacerationDamage: 0,
        anomalyMastery: 0,
        anomalyProficiency: 0,
        pen: 0,
        penRatio: 0,
        energyRegen: 0,
      },
      trace: [],
      menuRounding: 'menu_rule_missing',
      reason,
    },
  })
}

export function createAgentDevelopmentPanelProjection(input: {
  agent: RosterAgent
  discs: DriveDisc[]
  candidateDiscIds?: string[] | null
  planDiscIds?: string[] | null
  /** Confirmed scheme parameters are independent of the equipped account copy. */
  planWEngine?: Pick<RosterAgent['wEngineDetails'], 'id' | 'level' | 'ascension' | 'refinement'>
}): AgentDevelopmentPanelProjection {
  // Choose the requested identity before resolving assets. An invalid preview
  // must never silently become a different saved/equipped loadout.
  const selectedIds =
    input.candidateDiscIds ?? input.planDiscIds ?? input.agent.equippedDiscIds ?? []
  const source =
    input.candidateDiscIds != null
      ? '本次匹配方案'
      : input.planDiscIds != null
        ? '当前保存方案'
        : selectedIds.length
          ? '当前已装备'
          : '暂无完整配装'
  const discs = input.discs.filter((disc) => selectedIds.includes(disc.id))
  if (
    selectedIds.length !== 6 ||
    new Set(selectedIds).size !== 6 ||
    discs.length !== 6 ||
    new Set(discs.map((disc) => disc.slot)).size !== 6
  )
    return unsupported(
      source,
      '所选配装需要六张不同部位的有效驱动盘；请检查盘片引用或重新匹配。',
      input.agent.agentId,
    )
  const schemeEngine = input.planDiscIds != null && input.candidateDiscIds == null ? input.planWEngine : undefined
  const engine = schemeEngine ?? input.agent.wEngineDetails
  if (!engine.id) {
    return unsupported(
      source,
      '当前音擎未记录；请先补充当前音擎，不会用推荐音擎代填。',
      input.agent.agentId,
    )
  }
  if (engine.level === null) {
    return unsupported(source, '当前音擎等级未记录；请先补充等级。', input.agent.agentId)
  }
  if (!schemeEngine && !hasCurrentWEngineProgression(input.agent)) {
    return unsupported(
      source,
      '当前音擎参数未确认；请在“编辑当前状态”补充等级、突破与精炼。',
      input.agent.agentId,
    )
  }
  if (
    input.agent.skillLevels?.core == null ||
    !engine.id ||
    engine.refinement === null
  ) {
    return unsupported(
      source,
      '缺少核心技、已选音擎或改装事实，不能猜测面板输入。',
      input.agent.agentId,
    )
  }
  if (
    !Number.isInteger(input.agent.level) ||
    input.agent.level < 1 ||
    input.agent.level > 60 ||
    !Number.isInteger(engine.level) ||
    engine.level < 0 ||
    engine.level > 60
  )
    return unsupported(
      source,
      '角色等级必须为 1–60，音擎等级必须为 0–60 的整数；请修正已记录的等级。',
      input.agent.agentId,
    )
  const agentAscension = resolveRecordedAscension(input.agent.level, input.agent.ascension)
  const engineAscension = resolveRecordedAscension(
    engine.level,
    engine.ascension,
    true,
  )
  if (agentAscension === undefined || engineAscension === undefined) {
    return unsupported(
      source,
      '等级与突破阶段不匹配或突破阶段未确认；请补充或修正。',
      input.agent.agentId,
    )
  }
  return withLazyEvidence(input.agent.agentId, {
    source,
    result: projectOutOfCombatMenuPanel({
      agentId: input.agent.agentId,
      level: input.agent.level,
      ascension: agentAscension,
      mindscape: input.agent.mindscape,
      potentialImage: input.agent.potentialImage,
      // local1 -> explicit source-zero -1; learned2..7 -> A..F indices0..5.
      core: input.agent.skillLevels.core - 2,
      wEngine: {
        id: engine.id,
        level: engine.level,
        ascension: engineAscension,
        refinement: engine.refinement,
      },
      discs,
    }),
  })
}
