import type { AgentProfileField } from './agentProfileFieldProjection'
import type { GameData32BuildGuidance } from './gameData32BuildGuidance'
import type { CandidateWarehouseConstraint } from './candidateWarehouseConstraints'
import type { CandidateSetPlan } from './candidateSetPlans'
import { stableContentHash } from '../domain/stableContentHash'
import {
  decodePhoenixSkillPriority33,
  decodeSeverianSkillPriority33,
  mapPhoenixRecommendedMainStats33,
  mapSeverianRecommendedMainStats33,
} from './gameData33BuildStatMapping'
import type { MainStats } from './gameData33BuildStatMapping'
export {
  decodePhoenixSkillPriority33,
  decodeSeverianSkillPriority33,
  mapPhoenixRecommendedMainStats33,
  mapSeverianRecommendedMainStats33,
} from './gameData33BuildStatMapping'
import { projectGameData33BuildGuidanceFields } from './gameData33BuildGuidanceFields'
import {
  conditions,
  gameData33BuildSources,
  mainStatLines,
  phoenixBuildGuidanceData33 as raw,
  phoenixBuildGuidanceSource33,
  progressionDirections,
  severianBuildGuidanceData33 as severianRaw,
  severianBuildGuidanceSource33,
  severianConditions,
  severianMainStatLines,
  severianProgressionDirections,
  severianSourceIsReviewed,
  sourceIsReviewed,
  type SourceSelection,
} from './gameData33BuildGuidanceSources'
export {
  gameData33BuildSources,
  getPhoenixFormedReference33,
  getPhoenixInitialMasteryReference33,
  getPhoenixMindscapeBranch33,
  getSeverianFormedReference33,
  getSeverianMindscapeBranch33,
  phoenixBuildGuidanceSource33,
  severianBuildGuidanceSource33,
} from './gameData33BuildGuidanceSources'

export type GameData33BuildGuidance = Omit<GameData32BuildGuidance, 'gameVersion'> & {
  gameVersion: '3.3'
}
/** The Owner extends the existing consumer version union when integrating this candidate. */
export type CandidateWarehouseConstraint33 = Omit<CandidateWarehouseConstraint, 'gameVersion'> & {
  gameVersion: '3.3'
}

export function getGameData33BuildGuidance(
  agentId: string,
  selection?: SourceSelection,
): GameData33BuildGuidance | undefined {
  if (agentId === severianRaw.agentId) {
    const resolvedSelection = selection ?? severianBuildGuidanceSource33
    if (!severianSourceIsReviewed(resolvedSelection)) return undefined
    const mainStats = mapSeverianRecommendedMainStats33([
      ...severianRaw.rawRecommendation.priorityProps,
      ...severianRaw.rawRecommendation.alternativeProps,
    ])
    if (
      !mainStats ||
      !decodeSeverianSkillPriority33(severianRaw.rawRecommendation.skillPriorityGroups)
    )
      return undefined
    mainStats['6'] = ['atk_percent']
    const setPlans: CandidateSetPlan[] = [
      {
        pattern: '4+2',
        primarySetIds: ['set-dawns-bloom'],
        secondarySetIds: ['set-puffer-electro'],
        purpose: 'recommended',
        sourceText: '游戏内推荐：拂晓生花4件＋河豚电音2件。',
      },
      {
        pattern: '4+2',
        primarySetIds: ['set-dawns-bloom'],
        secondarySetIds: ['set-branch-blade-song'],
        purpose: 'recommended',
        sourceText: '游戏内备选：拂晓生花4件＋折枝剑歌2件。',
      },
      {
        pattern: '4+2',
        primarySetIds: ['set-woodpecker-electro'],
        secondarySetIds: ['set-puffer-electro'],
        purpose: 'recommended',
        sourceText: '游戏内备选：啄木鸟电音4件＋河豚电音2件。',
      },
    ]
    return {
      agentId: severianRaw.agentId,
      agentName: severianRaw.playerName,
      gameVersion: '3.3',
      sourceKeys: ['severianInGame33'],
      wEngineIds: ['wengine-14163'],
      wEngineDirections: [
        '禁罪囚笼：本轮具名S音擎P1成型参考；普攻命中后的攻击与风抗无视窗口按条件生效。',
      ],
      setDirections: setPlans.map((plan) => plan.sourceText!),
      setPlans,
      unresolvedSetDirections: [],
      mainStats,
      mainStatLines: [...severianMainStatLines],
      subStatPriorities: ['crit_rate', 'crit_dmg', 'atk_percent'],
      subStatPriorityKind: 'unranked',
      subStatLines: ['副词条：暴击率、暴击伤害与攻击力百分比；不由排列顺序生成伤害权重。'],
      teamAndBangbooPreconditions: [severianConditions[5]],
      progressionDirections: [...severianProgressionDirections],
      conditions: [...severianConditions],
      fixedCycleStatus: 'qualitative_only',
      fixedCycleMissingFields: ['完整动作时序、资源闭环及效果覆盖未由游戏内推荐证明。'],
    }
  }
  const resolvedSelection = selection ?? phoenixBuildGuidanceSource33
  if (agentId !== raw.agentId || !sourceIsReviewed(resolvedSelection)) return undefined
  const mainStats = mapPhoenixRecommendedMainStats33([
    ...raw.rawRecommendation.priorityProps,
    raw.rawRecommendation.alternativeProp,
  ])
  if (!mainStats || !decodePhoenixSkillPriority33(raw.rawRecommendation.skillPriorityGroups))
    return undefined
  // The raw alternative property is legal in several slots, not proof that
  // replacing the mastery main stat preserves this build's initial mastery gate.
  mainStats['6'] = ['anomaly_mastery']
  const setPlans: CandidateSetPlan[] = [
    {
      pattern: '4+2',
      primarySetIds: ['set-freedom-blues'],
      secondarySetIds: ['set-phaethons-melody'],
      purpose: 'recommended',
      sourceText: '游戏内推荐：自由蓝调4件＋法厄同之歌2件。',
    },
    {
      pattern: '4+2',
      primarySetIds: ['set-chaos-jazz'],
      secondarySetIds: ['set-phaethons-melody'],
      purpose: 'recommended',
      sourceText: '游戏内备选：混沌爵士4件＋法厄同之歌2件。',
    },
  ]
  return {
    agentId: raw.agentId,
    agentName: raw.playerName,
    gameVersion: '3.3',
    sourceKeys: ['phoenixInGame33'],
    wEngineIds: ['wengine-14164'],
    wEngineDirections: ['涅槃初翎：本轮具名S音擎P1成型参考；条件火伤不并入静态初始掌控。'],
    setDirections: setPlans.map((plan) => plan.sourceText!),
    setPlans,
    unresolvedSetDirections: [],
    mainStats,
    mainStatLines: [...mainStatLines],
    subStatPriorities: ['anomaly_proficiency', 'atk_percent'],
    subStatPriorityKind: 'unranked',
    subStatLines: ['副词条：异常精通与攻击力百分比；不由排列顺序生成伤害权重。'],
    teamAndBangbooPreconditions: [conditions[5]],
    progressionDirections: [...progressionDirections],
    conditions: [...conditions],
    fixedCycleStatus: 'qualitative_only',
    fixedCycleMissingFields: ['完整动作时序、资源闭环及效果覆盖未由游戏内推荐证明。'],
  }
}

export function getGameData33CandidateWarehouseConstraint(
  agentId: string,
  selection?: SourceSelection,
): CandidateWarehouseConstraint33 | undefined {
  const guidance = getGameData33BuildGuidance(agentId, selection)
  if (!guidance) return undefined
  const isSeverian = agentId === severianRaw.agentId
  const first = guidance.setPlans[0]!
  const constraint: Omit<CandidateWarehouseConstraint33, 'contentHash'> = {
    agentId,
    agentName: guidance.agentName,
    gameVersion: '3.3',
    status: 'candidate',
    setPlanReadiness: {
      status: 'executable',
      pattern: first.pattern,
      primarySetIds: [...first.primarySetIds],
      secondarySetIds: [...first.secondarySetIds],
    },
    sources: [
      isSeverian
        ? { ...gameData33BuildSources.severianInGame33 }
        : { ...gameData33BuildSources.phoenixInGame33 },
    ],
    setIds: [
      ...new Set(
        guidance.setPlans.flatMap((plan) => [...plan.primarySetIds, ...plan.secondarySetIds]),
      ),
    ],
    setPlans: structuredClone(guidance.setPlans) as CandidateSetPlan[],
    unresolvedSetDirections: [],
    mainStats: structuredClone(guidance.mainStats) as MainStats,
    subStatWeights: isSeverian
      ? { crit_rate: 1, crit_dmg: 1, atk_percent: 1 }
      : { anomaly_proficiency: 1, atk_percent: 1 },
    wEngineDirections: [...guidance.wEngineDirections],
    teamAndBangbooPreconditions: [
      ...guidance.teamAndBangbooPreconditions,
      ...(isSeverian ? severianConditions : conditions),
    ],
    progressionDirection: isSeverian
      ? [...severianProgressionDirections]
      : [...progressionDirections],
    gaps: [],
    boundary:
      '3.3游戏内来源候选约束；有效副词条沿原计数政策记1，不外推毕业数值、DPS、全局最优或Formal。',
  }
  return { ...constraint, contentHash: stableContentHash(constraint) }
}

export function getGameData33BuildGuidanceFields(
  agentId: string,
  selection?: SourceSelection,
): AgentProfileField[] {
  const guidance = getGameData33BuildGuidance(agentId, selection)
  const constraint = getGameData33CandidateWarehouseConstraint(agentId, selection)
  if (!guidance || !constraint) return []
  return projectGameData33BuildGuidanceFields(agentId, guidance, constraint, selection)
}
