import type { AccountBands } from './accountDecisionBands'
import {
  createCultivationPriorityInput,
  cultivationPriorityInputFingerprint,
  cultivationPriorityResultSchema,
  deriveCultivationPriorityTier,
  teamDecisionAuthorityContractId,
  type CultivationPriorityInput,
  type CultivationPriorityResult,
  type TeamRatingResult,
} from './teamDecisionAuthority'
import {
  evaluateAccountCultivationMarginalYield,
  type AccountCultivationMarginalYield,
} from './accountCultivationMarginalYield'
import {
  refineRealInvestmentDiscFit,
  type AccountCultivationRealInvestment,
} from './accountCultivationRealInvestment'

export { marginalGain } from './accountCultivationMarginalYield'

export function nextAction(tier: CultivationPriorityResult['tier']) {
  if (tier === 'ready_now') return '复核成员配装与实体盘互斥后，可进入单队配装。'
  if (tier === 'short_upgrade') return '先补齐具名小缺口，再重新分析该队。'
  if (tier === 'strategic_build') return '列入中期培养队列，先处理主要投入与资产冲突。'
  return '保留为实验候选，等待机制、证据或账户条件闭合。'
}

export function lightweightPriorityTier(
  rating: TeamRatingResult,
  account: AccountBands,
): CultivationPriorityResult['tier'] {
  if (
    rating.status !== 'rated' ||
    rating.ratingBand === 'Experimental' ||
    rating.confidence === 'experimental' ||
    account.currentReadiness === 'blocked' ||
    account.assetConflict === 'blocking'
  )
    return 'experimental'
  if (account.currentReadiness === 'ready' && account.investmentCost === 'low') return 'ready_now'
  if (account.currentReadiness === 'near_ready' && account.investmentCost === 'medium')
    return 'short_upgrade'
  return 'strategic_build'
}

export function createPriorityResult(input: CultivationPriorityInput): CultivationPriorityResult {
  const tier = deriveCultivationPriorityTier(input)
  if (input.teamRating.status !== 'rated') throw new Error('未评级队伍不能形成培养优先级。')
  return cultivationPriorityResultSchema.parse({
    contract: teamDecisionAuthorityContractId,
    candidateId: input.candidateId,
    tier,
    teamRatingBand: input.teamRating.ratingBand,
    confidence: input.teamRating.confidence,
    reasons: [
      `Team Rating ${input.teamRating.ratingBand} / ${input.teamRating.confidence}。`,
      input.currentReadiness === 'not_evaluated'
        ? '队伍成员已齐，配装与培养投入待核对。'
        : `账户完成度 ${input.currentReadiness}，投入 ${input.investmentCost}。`,
      ...input.potentialGaps.map(
        (gap) =>
          `${gap.agentName}解锁潜能后再推进该队培养（当前 ${gap.current} 级，需至少 ${gap.minimum} 级）。`,
      ),
      `覆盖增益 ${input.coverageGain}，边际收益 ${input.marginalAccountGain}。`,
    ],
    tradeoffs: [
      ...input.teamRating.tradeoffs,
      ...(input.assetConflict === 'not_evaluated'
        ? ['尚未为这支队伍匹配仓库，缺盘与共用情况待核对。']
        : input.assetConflict === 'none'
          ? []
          : [`实体资产冲突 ${input.assetConflict}。`]),
      ...(input.replacementCost === 'low'
        ? []
        : [`替换既有养成/配装的成本 ${input.replacementCost}。`]),
    ],
    nextAction:
      input.potentialGaps.length > 0
        ? `先将${input.potentialGaps[0]!.agentName}潜能解锁至 ${input.potentialGaps[0]!.minimum} 级，再重新分析该队。`
        : input.currentReadiness === 'not_evaluated'
          ? '先匹配这支队伍的驱动盘，再确认需要补齐的养成。'
          : nextAction(tier),
    inputFingerprint: cultivationPriorityInputFingerprint(input),
  })
}

export {
  evaluateAccountCultivationRealInvestment,
  type AgentRealInvestmentDetail,
  type RealInvestmentMaterialTotals,
  type AccountCultivationRealInvestment,
  type AccountCultivationRealInvestmentInput,
} from './accountCultivationRealInvestment'

export {
  evaluateAccountCultivationMarginalYield,
  compareCultivationPriorityPartialOrder,
  type CultivationYieldCategory,
  type AccountCultivationMarginalYield,
  type AccountCultivationMarginalYieldInput,
  type PartialOrderComparisonResult,
} from './accountCultivationMarginalYield'

export function refineCultivationPriorityWithTargetFit(input: {
  recommendation: {
    candidateId: string
    teamRating: TeamRatingResult
    accountInputs: Omit<CultivationPriorityInput, 'contract' | 'candidateId' | 'teamRating'>
    realInvestment?: AccountCultivationRealInvestment | null
    marginalYield?: AccountCultivationMarginalYield | null
  }
  fit: {
    status: 'ready' | 'partial' | 'unavailable'
    uniqueDiscCount: number
    gaps: readonly string[]
  }
  realInvestment?: AccountCultivationRealInvestment
}) {
  const previous = input.recommendation.accountInputs
  const previousInvestment = input.realInvestment ?? input.recommendation.realInvestment ?? null
  // Unavailable conflates missing constraints with no physical fit. Until the query
  // provides a typed physical cause, it cannot prove eighteen missing inventory slots.
  const missingDiscSlots =
    input.fit.status === 'unavailable' ? null : Math.max(0, 18 - input.fit.uniqueDiscCount)
  const realInvestment = previousInvestment
    ? refineRealInvestmentDiscFit(previousInvestment, missingDiscSlots)
    : null
  const unknownInvestment =
    realInvestment &&
    (realInvestment.missingSummary.unrecordedSkillsCount > 0 ||
      realInvestment.agentInvestments.some((agent) => agent.owned && agent.level.gap === null))
  const knownLevelGap = realInvestment?.agentInvestments.some((agent) => (agent.level.gap ?? 0) > 0)
  const distance = {
    ...previous.buildCompletionDistance,
    missingWEngines: 0,
    missingDiscSlots,
  }
  const currentReadiness: CultivationPriorityInput['currentReadiness'] =
    distance.missingAgents > 0
      ? 'blocked'
      : input.fit.status === 'unavailable' || unknownInvestment
        ? 'not_evaluated'
        : input.fit.status === 'ready' &&
            distance.missingSkillInvestments === 0 &&
            !knownLevelGap &&
            distance.missingPotentialInvestments === 0
          ? 'ready'
          : missingDiscSlots !== null &&
              missingDiscSlots <= 6 &&
              distance.missingSkillInvestments <= 3 &&
              distance.missingPotentialInvestments === 0
            ? 'near_ready'
            : 'development'
  const investmentCost: CultivationPriorityInput['investmentCost'] =
    realInvestment?.investmentCost ??
    (currentReadiness === 'ready'
      ? 'low'
      : currentReadiness === 'near_ready'
        ? 'medium'
        : currentReadiness === 'development'
          ? 'high'
          : 'unknown')
  const priorityDraft = {
    contract: teamDecisionAuthorityContractId,
    candidateId: input.recommendation.candidateId,
    teamRating: input.recommendation.teamRating,
    ...previous,
    currentReadiness,
    investmentCost,
    assetConflict:
      input.fit.status === 'ready'
        ? 'none'
        : input.fit.status === 'partial'
          ? 'resolvable'
          : 'not_evaluated',
    replacementCost:
      input.fit.status === 'ready' ? 'low' : input.fit.status === 'partial' ? 'medium' : 'unknown',
    buildCompletionDistance: distance,
  } satisfies Omit<CultivationPriorityInput, 'marginalAccountGain'>
  const marginalYield = evaluateAccountCultivationMarginalYield({
    candidateId: input.recommendation.candidateId,
    teamRating: input.recommendation.teamRating,
    coverageGain: priorityDraft.coverageGain,
    currentReadiness: priorityDraft.currentReadiness,
    investmentCost: priorityDraft.investmentCost,
    ...(realInvestment ? { realInvestment } : {}),
  })
  const priorityInput = createCultivationPriorityInput({
    ...priorityDraft,
    marginalAccountGain: marginalYield.marginalAccountGain,
  })
  const base = createPriorityResult(priorityInput)
  const gaps = [...new Set(input.fit.gaps)]

  const additionalReasons: string[] = []
  if (realInvestment) {
    if (realInvestment.missingSummary.unrecordedWEnginesCount > 0) {
      additionalReasons.push(
        `音擎提示：队伍中有 ${realInvestment.missingSummary.unrecordedWEnginesCount} 名成员未记录当前实装音擎；不假定为未装备或0级，推荐音擎按60级基线供确认。`,
      )
    }
    if (realInvestment.materialTotals.denny > 0) {
      additionalReasons.push(
        `技能材料预估：需丁尼 ×${realInvestment.materialTotals.denny.toLocaleString('zh-CN')}，仓鼠笼访问器 ×${realInvestment.materialTotals.hamsterCagePasses}，周本材料 ×${realInvestment.materialTotals.notoriousHuntMaterials}。`,
      )
    }
  }

  const cultivationPriority = cultivationPriorityResultSchema.parse({
    ...base,
    reasons: [
      ...base.reasons,
      missingDiscSlots === null
        ? '本次未能完成配装计算，尚不能确定实际缺盘数量。'
        : `显式目标配装：${input.fit.status}，驱动盘 ${18 - missingDiscSlots}/18；音擎与邦布按推荐候选由玩家确认，不计入实体库存缺口。`,
      ...additionalReasons,
      ...(realInvestment?.reasons ?? []),
    ],
    tradeoffs: [...base.tradeoffs, ...gaps, ...(realInvestment?.tradeoffs ?? [])],
    nextAction:
      input.fit.status === 'ready'
        ? base.nextAction
        : (gaps[0] ??
          (missingDiscSlots === null
            ? '核对队伍配装资料后重新匹配。'
            : '先补齐目标队伍的实体驱动盘缺口，再重新配装。')),
  })
  return {
    contract: 'soda-target-team-cultivation-refinement/v1' as const,
    candidateId: input.recommendation.candidateId,
    accountInputs: priorityInput,
    cultivationPriority,
    gaps,
    realInvestment: realInvestment ?? null,
    marginalYield,
    sideEffect: 'read_only' as const,
    boundary:
      '只细化当前已点击目标队伍的账号完成度与培养建议；不回写基础短名单、不改 Team Rating，也不触发其他队伍求解。',
  }
}
