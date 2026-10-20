import type { AccountRoster } from '../assault/types'
import { resolveSkillInvestmentMaterials } from '../calculation/skillInvestmentMaterials'
import type { SkillKey } from '../calculation/skillInvestmentPolicy'
import { projectSkillInvestmentNextLevels } from './skillInvestmentProjection'
import { resolveWEngine } from './wEngineResolver'
import { getProjectedBuildKnowledgeProfile } from '../gameDataPacks/agentProfile'
import {
  getCurrentBuildProfile,
  getBuildRecommendation,
  getSelectedBuildBranchId,
} from '../assault/currentBuildProfiles'
import { agentDevelopmentSkillRecommendations } from '../pages/agentDevelopmentSkillRecommendations'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import type { CultivationPriorityInput } from './teamDecisionAuthority'

export type AgentRealInvestmentDetail = {
  agentId: string
  owned: boolean
  level: {
    current: number | null
    target: number
    gap: number | null
  }
  wEngine: {
    status: 'recorded' | 'unrecorded'
    wEngineId: string | null
    level: number | null
    refinement: number | null
    notice: string
  }
  skills: {
    knownGapCount: number
    unrecordedCount: number
    gaps: readonly {
      skill: SkillKey
      currentLevel: number | null
      targetLevel: number
      fromBaseLevel: number
      toBaseLevel: number
      materials: ReturnType<typeof resolveSkillInvestmentMaterials>
    }[]
  }
}

export type RealInvestmentMaterialTotals = {
  denny: number
  chips: readonly { attribute: string; grade: number; quantity: number }[]
  hamsterCagePasses: number
  expertChallengeMaterials: number
  notoriousHuntMaterials: number
  unresolvedStepsCount: number
}

export type AccountCultivationRealInvestment = {
  contract: 'soda-account-cultivation-real-investment/v1'
  agentInvestments: readonly AgentRealInvestmentDetail[]
  materialTotals: RealInvestmentMaterialTotals
  missingSummary: {
    missingAgents: number
    missingDiscSlots: number | null
    missingSkillGaps: number
    missingPotentialGaps: number
    unrecordedWEnginesCount: number
    unrecordedSkillsCount: number
  }
  investmentCost: CultivationPriorityInput['investmentCost']
  reasons: readonly string[]
  tradeoffs: readonly string[]
}

export type AccountCultivationRealInvestmentInput = {
  agentIds?: readonly string[]
  memberIds?: readonly string[]
  roster: AccountRoster
  targetFit?: {
    status: 'ready' | 'partial' | 'unavailable'
    uniqueDiscCount: number
    gaps: readonly string[]
  }
  potentialGaps?: readonly {
    agentId: string
    agentName: string
    current: number
    minimum: number
  }[]
  /** Per-authority-call cache; callers must create a fresh map for each account snapshot. */
  agentInvestmentCache?: Map<string, AgentRealInvestmentDetail>
}

export function realInvestmentCost(
  investment: Pick<AccountCultivationRealInvestment, 'agentInvestments' | 'missingSummary'>,
): CultivationPriorityInput['investmentCost'] {
  const summary = investment.missingSummary
  if (
    summary.missingAgents > 0 ||
    summary.missingPotentialGaps > 0 ||
    summary.missingSkillGaps > 6 ||
    (summary.missingDiscSlots !== null && summary.missingDiscSlots > 6)
  )
    return 'high'
  if (
    summary.missingSkillGaps > 1 ||
    (summary.missingDiscSlots !== null && summary.missingDiscSlots > 0) ||
    investment.agentInvestments.some((agent) => agent.owned && (agent.level.gap ?? 0) > 0)
  )
    return 'medium'
  if (
    summary.unrecordedSkillsCount > 0 ||
    investment.agentInvestments.some((agent) => agent.owned && agent.level.gap === null)
  )
    return 'unknown'
  return 'low'
}

export function refineRealInvestmentDiscFit(
  investment: AccountCultivationRealInvestment,
  missingDiscSlots: number | null,
): AccountCultivationRealInvestment {
  const discReason = (slots: number | null) => `仍缺 ${slots} 张实体驱动盘（共需 18 张不同盘）。`
  const discTradeoff = (slots: number | null) =>
    `实体盘存在 ${slots} 个槽位缺口，需要刷取或调整互斥分配。`
  const previous = investment.missingSummary.missingDiscSlots
  const next = { ...investment, missingSummary: { ...investment.missingSummary, missingDiscSlots } }
  return {
    ...next,
    investmentCost: missingDiscSlots === null ? 'unknown' : realInvestmentCost(next),
    reasons: [
      ...investment.reasons.filter((reason) => reason !== discReason(previous)),
      ...(missingDiscSlots !== null && missingDiscSlots > 0 ? [discReason(missingDiscSlots)] : []),
    ],
    tradeoffs: [
      ...investment.tradeoffs.filter((reason) => reason !== discTradeoff(previous)),
      ...(missingDiscSlots !== null && missingDiscSlots > 0
        ? [discTradeoff(missingDiscSlots)]
        : []),
    ],
  }
}

export function evaluateAccountCultivationRealInvestment(
  input: AccountCultivationRealInvestmentInput,
): AccountCultivationRealInvestment {
  const agentIds = input.memberIds ?? input.agentIds ?? []
  let missingAgents = 0
  let unrecordedWEnginesCount = 0
  let unrecordedSkillsCount = 0
  let missingSkillGaps = 0

  let totalDenny = 0
  let totalHamster = 0
  let totalExpert = 0
  let totalNotorious = 0
  let unresolvedStepsCount = 0
  const chipsMap = new Map<string, { attribute: string; grade: number; quantity: number }>()

  const agentInvestments: AgentRealInvestmentDetail[] = agentIds.map((agentId) => {
    const cached = input.agentInvestmentCache?.get(agentId)
    if (cached) return cached
    const detail = projectAgentRealInvestment(agentId, input.roster)
    input.agentInvestmentCache?.set(agentId, detail)
    return detail
  })

  for (const detail of agentInvestments) {
    if (!detail.owned) {
      missingAgents++
      continue
    }
    if (detail.wEngine.status === 'unrecorded') unrecordedWEnginesCount++
    missingSkillGaps += detail.skills.knownGapCount
    unrecordedSkillsCount += detail.skills.unrecordedCount
    for (const gap of detail.skills.gaps) {
      const matRes = gap.materials
      if (matRes.status === 'supported') {
        for (const item of matRes.materials) {
          if (item.kind === 'denny') totalDenny += item.quantity
          else if (item.kind === 'hamster_cage_pass') totalHamster += item.quantity
          else if (item.kind === 'expert_challenge') totalExpert += item.quantity
          else if (item.kind === 'notorious_hunt') totalNotorious += item.quantity
          else if (item.kind === 'attribute_chip') {
            const chipKey = `${item.attribute}:${item.grade}`
            const existing = chipsMap.get(chipKey)
            if (existing) existing.quantity += item.quantity
            else
              chipsMap.set(chipKey, {
                attribute: item.attribute,
                grade: item.grade,
                quantity: item.quantity,
              })
          }
        }
      } else unresolvedStepsCount++
    }
  }

  const missingDiscSlots =
    input.targetFit === undefined || input.targetFit.status === 'unavailable'
      ? null
      : Math.max(0, 18 - input.targetFit.uniqueDiscCount)

  const missingPotentialGaps = input.potentialGaps?.length ?? 0

  const missingSummary = {
    missingAgents,
    missingDiscSlots,
    missingSkillGaps,
    missingPotentialGaps,
    unrecordedWEnginesCount,
    unrecordedSkillsCount,
  }
  const investmentCost = realInvestmentCost({ agentInvestments, missingSummary })

  const reasons: string[] = []
  if (missingAgents > 0) reasons.push(`缺少 ${missingAgents} 名队伍成员。`)
  if (missingDiscSlots !== null && missingDiscSlots > 0)
    reasons.push(`仍缺 ${missingDiscSlots} 张实体驱动盘（共需 18 张不同盘）。`)
  if (missingSkillGaps > 0) reasons.push(`仍有 ${missingSkillGaps} 处技能等级待提升。`)
  if (totalDenny > 0) reasons.push(`技能升级预估需丁尼 ×${totalDenny.toLocaleString('zh-CN')}。`)
  if (unrecordedWEnginesCount > 0)
    reasons.push(
      `队伍中有 ${unrecordedWEnginesCount} 名成员未记录当前实装音擎；不假定为未装备或0级。`,
    )
  if (unrecordedSkillsCount > 0)
    reasons.push(
      `仍有 ${unrecordedSkillsCount} 项技能等级或影画加级待确认；材料合计仅覆盖已知升级。`,
    )

  const tradeoffs: string[] = []
  if (totalHamster > 0) tradeoffs.push(`技能达标需消耗仓鼠笼访问器 ×${totalHamster}。`)
  if (totalNotorious > 0) tradeoffs.push(`技能达标需消耗周本材料 ×${totalNotorious}。`)
  if (missingDiscSlots !== null && missingDiscSlots > 0)
    tradeoffs.push(`实体盘存在 ${missingDiscSlots} 个槽位缺口，需要刷取或调整互斥分配。`)

  return {
    contract: 'soda-account-cultivation-real-investment/v1',
    agentInvestments,
    materialTotals: {
      denny: totalDenny,
      chips: Array.from(chipsMap.values()),
      hamsterCagePasses: totalHamster,
      expertChallengeMaterials: totalExpert,
      notoriousHuntMaterials: totalNotorious,
      unresolvedStepsCount,
    },
    missingSummary,
    investmentCost,
    reasons,
    tradeoffs,
  }
}

function projectAgentRealInvestment(
  agentId: string,
  roster: AccountRoster,
): AgentRealInvestmentDetail {
  const agent = roster.agents.find((a) => a.agentId === agentId)
  if (!agent || !agent.owned) {
    return {
      agentId,
      owned: false,
      level: { current: null, target: 60, gap: 60 },
      wEngine: {
        status: 'unrecorded',
        wEngineId: null,
        level: null,
        refinement: null,
        notice: '未拥有该代理人，尚无实装音擎。',
      },
      skills: { knownGapCount: 7, unrecordedCount: 0, gaps: [] },
    }
  }

  const currentLevel = agent.level ?? null
  const levelGap =
    currentLevel !== null &&
    Number.isInteger(currentLevel) &&
    currentLevel >= 1 &&
    currentLevel <= 60
      ? 60 - currentLevel
      : null
  const wResolution = resolveWEngine({ agent, legacyWEngines: roster.wEngines })
  const isWEngineRecorded =
    wResolution.matchStatus !== 'current_unrecorded' && wResolution.current !== null
  const wEngineDetail: AgentRealInvestmentDetail['wEngine'] = isWEngineRecorded
    ? {
        status: 'recorded',
        wEngineId: wResolution.current!.engineId,
        level: wResolution.current!.level,
        refinement: wResolution.current!.refinement,
        notice: '已记录实装音擎。',
      }
    : {
        status: 'unrecorded',
        wEngineId: null,
        level: null,
        refinement: null,
        notice: '未记录当前实装音擎；不假定为未装备或0级，推荐音擎按60级基线供玩家确认。',
      }
  const profile = getProjectedBuildKnowledgeProfile(agent.agentId)
  const currentProfile = getCurrentBuildProfile(agent.agentId)
  const recommendation = currentProfile
    ? getBuildRecommendation(
        currentProfile,
        getSelectedBuildBranchId(agent) ?? currentProfile.defaultBranchId,
      )
    : null
  const targetSkills = agentDevelopmentSkillRecommendations(
    agent.agentId,
    profile.recommendation?.skillPriority ??
      getCandidateWarehouseConstraint(agent.agentId)?.progressionDirection ??
      [],
    recommendation?.skillPriority ?? [],
    { skillLevels: agent.skillLevels, mindscape: agent.mindscape },
  ).skills
  const projectedSkills = projectSkillInvestmentNextLevels({
    agentId,
    skillLevels: agent.skillLevels,
    mindscape: agent.mindscape,
    rows: targetSkills,
  })
  let agentKnownGaps = 0
  let agentUnrecorded = 0
  const gaps: AgentRealInvestmentDetail['skills']['gaps'][number][] = []
  for (const targetSkill of projectedSkills) {
    const key = targetSkill.key as SkillKey
    const recordedLevel = agent.skillLevels?.[key]
    const evidence = targetSkill.nextLevelEvidence
    if (
      targetSkill.targetLevel === null ||
      evidence.status === 'unknown' ||
      evidence.status === 'unsupported'
    ) {
      agentUnrecorded++
      continue
    }
    if (evidence.status === 'no_upgrade') continue
    const currentBaseLevel = evidence.fromBaseLevel
    const effectiveBonus = recordedLevel! - currentBaseLevel
    const targetBaseLevel = targetSkill.targetLevel - effectiveBonus
    if (currentBaseLevel < targetBaseLevel) {
      agentKnownGaps++
      for (let lvl = currentBaseLevel; lvl < targetBaseLevel; lvl++) {
        gaps.push({
          skill: key,
          currentLevel: recordedLevel,
          targetLevel: targetSkill.targetLevel,
          fromBaseLevel: lvl,
          toBaseLevel: lvl + 1,
          materials: resolveSkillInvestmentMaterials({
            agentId: agent.agentId,
            skill: key,
            currentBaseLevel: lvl,
          }),
        })
      }
    }
  }
  return {
    agentId,
    owned: true,
    level: { current: currentLevel, target: 60, gap: levelGap },
    wEngine: wEngineDetail,
    skills: { knownGapCount: agentKnownGaps, unrecordedCount: agentUnrecorded, gaps },
  }
}
