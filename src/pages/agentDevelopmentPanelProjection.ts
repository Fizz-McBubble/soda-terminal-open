import type { RosterAgent } from '../assault/types'
import type { DriveDisc } from '../domain/schemas'
import { defaultAscensionForLevel } from '../gameDataPacks/panel/wEngineGrowth'
import { projectOutOfCombatMenuPanel, type PanelResult } from '../calculation/outOfCombatPanel'
import {
  getGraduationCandidateProfile,
  type GraduationCandidateProfile,
} from '../gameDataPacks/graduationCandidateProfileProjection'
import {
  getL3AgentDevelopmentEvidence,
  type L3AgentDevelopmentEvidence,
} from '../gameDataPacks/l3ProductionProjection'

export type AgentDevelopmentPanelProjection = {
  source: '本次匹配方案' | '当前保存方案' | '当前已装备' | '暂无完整配装'
  result: PanelResult
  dataFoundation: L3AgentDevelopmentEvidence | null
  graduationCandidate: GraduationCandidateProfile | null
}

function unsupported(
  source: AgentDevelopmentPanelProjection['source'],
  reason: string,
  dataFoundation: L3AgentDevelopmentEvidence | null,
  graduationCandidate: GraduationCandidateProfile | null,
): AgentDevelopmentPanelProjection {
  return {
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
    dataFoundation,
    graduationCandidate,
  }
}

export function createAgentDevelopmentPanelProjection(input: {
  agent: RosterAgent
  discs: DriveDisc[]
  candidateDiscIds?: string[] | null
  planDiscIds?: string[] | null
}): AgentDevelopmentPanelProjection {
  const dataFoundation = getL3AgentDevelopmentEvidence(input.agent.agentId)
  const graduationCandidate = getGraduationCandidateProfile(input.agent.agentId)
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
      dataFoundation,
      graduationCandidate,
    )
  if (!input.agent.wEngineDetails.id) {
    return unsupported(
      source,
      '当前音擎未记录；请先补充当前音擎，不会用推荐音擎代填。',
      dataFoundation,
      graduationCandidate,
    )
  }
  if (input.agent.wEngineDetails.level === null) {
    return unsupported(
      source,
      '当前音擎等级未记录；请先补充等级。',
      dataFoundation,
      graduationCandidate,
    )
  }
  if (
    input.agent.skillLevels?.core == null ||
    !input.agent.wEngineDetails.id ||
    input.agent.wEngineDetails.refinement === null
  ) {
    return unsupported(
      source,
      '缺少核心技、已选音擎或改装事实，不能猜测面板输入。',
      dataFoundation,
      graduationCandidate,
    )
  }
  if (
    !Number.isInteger(input.agent.level) ||
    input.agent.level < 1 ||
    input.agent.level > 60 ||
    !Number.isInteger(input.agent.wEngineDetails.level) ||
    input.agent.wEngineDetails.level < 1 ||
    input.agent.wEngineDetails.level > 60
  )
    return unsupported(
      source,
      '角色与音擎等级必须为 1–60 的整数；请修正已记录的等级。',
      dataFoundation,
      graduationCandidate,
    )
  return {
    source,
    result: projectOutOfCombatMenuPanel({
      agentId: input.agent.agentId,
      level: input.agent.level,
      ascension: input.agent.ascension ?? defaultAscensionForLevel(input.agent.level),
      mindscape: input.agent.mindscape,
      // local1 -> explicit source-zero -1; learned2..7 -> A..F indices0..5.
      core: input.agent.skillLevels.core - 2,
      wEngine: {
        id: input.agent.wEngineDetails.id,
        level: input.agent.wEngineDetails.level,
        ascension:
          input.agent.wEngineDetails.ascension ??
          defaultAscensionForLevel(input.agent.wEngineDetails.level),
        refinement: input.agent.wEngineDetails.refinement,
      },
      discs,
    }),
    dataFoundation,
    graduationCandidate,
  }
}
