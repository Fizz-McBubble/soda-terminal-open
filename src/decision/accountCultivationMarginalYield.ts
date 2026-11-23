import type { TeamRatingResult, CultivationPriorityInput } from './teamDecisionAuthority'
import type { AccountCultivationRealInvestment } from './accountCultivationRealInvestment'
import { referenceRatingBands, type GenericReferenceInterval } from './teamReferenceInterval'

export function marginalGain(
  rating: TeamRatingResult,
  coverageGain: CultivationPriorityInput['coverageGain'],
): CultivationPriorityInput['marginalAccountGain'] {
  if (rating.status !== 'rated') return 'unknown'
  if (rating.ratingBand === 'Experimental') return 'unknown'
  if (coverageGain === 'new_required_team' && ['S+', 'S'].includes(rating.ratingBand))
    return 'transformative'
  if (coverageGain === 'new_required_team' || ['S+', 'S', 'A+'].includes(rating.ratingBand))
    return 'high'
  if (rating.ratingBand === 'A') return 'medium'
  return 'low'
}

export type CultivationYieldCategory =
  | 'immediate_high_impact'
  | 'high_efficiency_progression'
  | 'strategic_high_potential'
  | 'standard_development'
  | 'redundant_marginal'
  | 'unrealizable'

export type AccountCultivationMarginalYieldInput = {
  candidateId: string
  teamRating: TeamRatingResult
  coverageGain: CultivationPriorityInput['coverageGain']
  currentReadiness: CultivationPriorityInput['currentReadiness']
  investmentCost: CultivationPriorityInput['investmentCost']
  realInvestment?: AccountCultivationRealInvestment
}

export type AccountCultivationMarginalYield = {
  contract: 'soda-account-cultivation-marginal-yield/v1'
  candidateId: string
  marginalAccountGain: CultivationPriorityInput['marginalAccountGain']
  yieldCategory: CultivationYieldCategory
  tradeoffSummary: string
  referenceInterval?: GenericReferenceInterval
  strengthUnrated?: boolean
  multiDimensionalVector: {
    ratingRank: number
    confidenceRank: number
    coverageRank: number
    readinessRank: number
    investmentEaseRank: number
  }
}

export function evaluateAccountCultivationMarginalYield(
  input: AccountCultivationMarginalYieldInput,
): AccountCultivationMarginalYield {
  const marginalAccountGain = marginalGain(input.teamRating, input.coverageGain)
  const investmentCost = input.realInvestment?.investmentCost ?? input.investmentCost
  const unknownCultivation =
    input.realInvestment &&
    (input.realInvestment.missingSummary.unrecordedSkillsCount > 0 ||
      input.realInvestment.agentInvestments.some(
        (agent) => agent.owned && agent.level.gap === null,
      ))
  const readiness =
    unknownCultivation && input.currentReadiness !== 'blocked'
      ? 'not_evaluated'
      : input.currentReadiness

  let yieldCategory: CultivationYieldCategory = 'standard_development'
  if (input.teamRating.status !== 'rated' || readiness === 'blocked') {
    yieldCategory = 'unrealizable'
  } else if (input.coverageGain === 'redundancy') {
    yieldCategory = 'redundant_marginal'
  } else if (readiness === 'ready' && ['S+', 'S', 'A+'].includes(input.teamRating.ratingBand)) {
    yieldCategory = 'immediate_high_impact'
  } else if (
    readiness === 'near_ready' &&
    ['S+', 'S', 'A+'].includes(input.teamRating.ratingBand)
  ) {
    yieldCategory = 'high_efficiency_progression'
  } else if (readiness === 'development' && ['S+', 'S'].includes(input.teamRating.ratingBand)) {
    yieldCategory = 'strategic_high_potential'
  }

  const ratingRank =
    input.teamRating.status !== 'rated'
      ? 0
      : input.teamRating.ratingBand === 'S+'
        ? 5
        : input.teamRating.ratingBand === 'S'
          ? 4
          : input.teamRating.ratingBand === 'A+'
            ? 3
            : input.teamRating.ratingBand === 'A'
              ? 2
              : input.teamRating.ratingBand === 'B+'
                ? 1.5
                : input.teamRating.ratingBand === 'C'
                  ? 0.5
                  : input.teamRating.ratingBand === 'B'
                    ? 1
                    : 0

  const confidenceRank =
    input.teamRating.status !== 'rated'
      ? 0
      : input.teamRating.confidence === 'high'
        ? 3
        : input.teamRating.confidence === 'medium'
          ? 2
          : input.teamRating.confidence === 'low'
            ? 1
            : 0

  const coverageRank =
    input.coverageGain === 'new_required_team'
      ? 3
      : input.coverageGain === 'new_scenario'
        ? 2
        : input.coverageGain === 'redundancy'
          ? 1
          : 0

  const readinessRank =
    readiness === 'ready' ? 3 : readiness === 'near_ready' ? 2 : readiness === 'development' ? 1 : 0

  const investmentEaseRank =
    investmentCost === 'low'
      ? 3
      : investmentCost === 'medium'
        ? 2
        : investmentCost === 'high'
          ? 1
          : 0

  const bandText = input.teamRating.status === 'rated' ? input.teamRating.ratingBand : '未评级'
  const tradeoffSummary =
    `队伍评级 ${bandText}，覆盖增益 ${input.coverageGain}，成型就绪度 ${readiness}，真实投入 ${investmentCost}。` +
    (yieldCategory === 'immediate_high_impact'
      ? '即时可用且处于高强度区间，具备极佳的边际收益转化效率。'
      : yieldCategory === 'high_efficiency_progression'
        ? '仅需少量技能或盘位升级即可成型，推进收益明确。'
        : yieldCategory === 'strategic_high_potential'
          ? '具备顶尖强度潜力，但需要较长周期的资源积累。'
          : yieldCategory === 'redundant_marginal'
            ? '已有同定位成熟队伍，边际提升有限。'
            : '保持既有评级与投入观察，不把倍率与材料折算为单一伪ROI。')

  return {
    contract: 'soda-account-cultivation-marginal-yield/v1',
    candidateId: input.candidateId,
    marginalAccountGain,
    yieldCategory,
    tradeoffSummary:
      tradeoffSummary +
      (input.teamRating.status === 'rated' && input.teamRating.referenceInterval
        ? ` 参考范围${input.teamRating.referenceInterval.lower}～${input.teamRating.referenceInterval.upper}；收益分类仅取保守下界，重叠范围不构成严格强弱。`
        : ''),
    ...(input.teamRating.status === 'rated' && input.teamRating.referenceInterval
      ? { referenceInterval: structuredClone(input.teamRating.referenceInterval) }
      : {}),
    ...(input.teamRating.status === 'rated' &&
    input.teamRating.playAdmission === 'complete_conditional_play'
      ? { strengthUnrated: true }
      : {}),
    multiDimensionalVector: {
      ratingRank,
      confidenceRank,
      coverageRank,
      readinessRank,
      investmentEaseRank,
    },
  }
}

export type PartialOrderComparisonResult = {
  relation: 'left_dominates' | 'right_dominates' | 'incomparable_tradeoff' | 'equivalent'
  leftWins: readonly string[]
  rightWins: readonly string[]
  tradeoffSummary: string
  strengthRelation:
    | 'left_preferred'
    | 'right_preferred'
    | 'same_reference_range'
    | 'overlapping_reference_ranges'
    | 'not_established'
}

export function compareCultivationPriorityPartialOrder(
  left: AccountCultivationMarginalYield,
  right: AccountCultivationMarginalYield,
): PartialOrderComparisonResult {
  const leftWins: string[] = []
  const rightWins: string[] = []

  const range = (value: AccountCultivationMarginalYield) =>
    value.referenceInterval
      ? [
          5 - referenceRatingBands.indexOf(value.referenceInterval.lower),
          5 - referenceRatingBands.indexOf(value.referenceInterval.upper),
        ]
      : [value.multiDimensionalVector.ratingRank, value.multiDimensionalVector.ratingRank]
  const [leftLower, leftUpper] = range(left) as [number, number]
  const [rightLower, rightUpper] = range(right) as [number, number]
  let strengthRelation: PartialOrderComparisonResult['strengthRelation'] = 'same_reference_range'
  const qualityLabel =
    left.referenceInterval || right.referenceInterval
      ? '队伍参考范围更高'
      : '队伍综合评级与置信度更高'
  if (left.strengthUnrated || right.strengthUnrated) {
    strengthRelation = 'not_established'
  } else if (leftLower > rightUpper) {
    leftWins.push(qualityLabel)
    strengthRelation = 'left_preferred'
  } else if (rightLower > leftUpper) {
    rightWins.push(qualityLabel)
    strengthRelation = 'right_preferred'
  } else if (leftLower !== rightLower || leftUpper !== rightUpper)
    strengthRelation = 'overlapping_reference_ranges'
  else if (left.multiDimensionalVector.confidenceRank > right.multiDimensionalVector.confidenceRank)
    leftWins.push('参考置信度更高')
  else if (left.multiDimensionalVector.confidenceRank < right.multiDimensionalVector.confidenceRank)
    rightWins.push('参考置信度更高')

  if (left.multiDimensionalVector.coverageRank > right.multiDimensionalVector.coverageRank) {
    leftWins.push('账户阵容覆盖增益更显著')
  } else if (right.multiDimensionalVector.coverageRank > left.multiDimensionalVector.coverageRank) {
    rightWins.push('账户阵容覆盖增益更显著')
  }

  if (left.multiDimensionalVector.readinessRank > right.multiDimensionalVector.readinessRank) {
    leftWins.push('即时成型与装备就绪度更高')
  } else if (
    right.multiDimensionalVector.readinessRank > left.multiDimensionalVector.readinessRank
  ) {
    rightWins.push('即时成型与装备就绪度更高')
  }

  if (
    left.multiDimensionalVector.investmentEaseRank > right.multiDimensionalVector.investmentEaseRank
  ) {
    leftWins.push('养成材料与升级投入更低')
  } else if (
    right.multiDimensionalVector.investmentEaseRank > left.multiDimensionalVector.investmentEaseRank
  ) {
    rightWins.push('养成材料与升级投入更低')
  }

  let relation: PartialOrderComparisonResult['relation']
  let tradeoffSummary: string

  if (
    strengthRelation === 'overlapping_reference_ranges' ||
    strengthRelation === 'not_established'
  ) {
    relation = 'incomparable_tradeoff'
    tradeoffSummary = `${strengthRelation === 'not_established' ? '存在未评级玩法' : '参考区间重叠'}，不能由下界推出强弱或支配；左侧已知账户优势：${leftWins.join('、') || '无'}；右侧：${rightWins.join('、') || '无'}。`
  } else if (leftWins.length > 0 && rightWins.length === 0) {
    relation = 'left_dominates'
    tradeoffSummary = `左侧候选在各维度均不劣于右侧，且在部分维度占据确定性优势（${leftWins.join('、')}），形成支配关系。`
  } else if (rightWins.length > 0 && leftWins.length === 0) {
    relation = 'right_dominates'
    tradeoffSummary = `右侧候选在各维度均不劣于左侧，且在部分维度占据确定性优势（${rightWins.join('、')}），形成支配关系。`
  } else if (leftWins.length === 0 && rightWins.length === 0) {
    relation = 'equivalent'
    tradeoffSummary = '两侧候选在队伍强度、覆盖增益、就绪度与投入成本上处于同一偏序水平。'
  } else {
    relation = 'incomparable_tradeoff'
    tradeoffSummary = `两侧候选存在多维权衡：左侧优在【${leftWins.join('、')}】，右侧优在【${rightWins.join('、')}】；保留合理偏序，不以伪单一综合分强行合并。`
  }

  return {
    relation,
    leftWins,
    rightWins,
    tradeoffSummary,
    strengthRelation,
  }
}

/** A category derived from a conservative endpoint cannot override unknown or
 * overlapping strength evidence. Account readiness remains a separate input. */
export function compareAccountCultivationYield(
  left: AccountCultivationMarginalYield,
  right: AccountCultivationMarginalYield,
) {
  const categoryOrder: Record<AccountCultivationMarginalYield['yieldCategory'], number> = {
    immediate_high_impact: 0,
    high_efficiency_progression: 1,
    strategic_high_potential: 2,
    standard_development: 3,
    redundant_marginal: 4,
    unrealizable: 5,
  }
  const partialOrder = compareCultivationPriorityPartialOrder(left, right)
  const categoryDifference = categoryOrder[left.yieldCategory] - categoryOrder[right.yieldCategory]
  if (
    categoryDifference &&
    !['overlapping_reference_ranges', 'not_established'].includes(partialOrder.strengthRelation)
  )
    return categoryDifference
  if (partialOrder.relation === 'left_dominates') return -1
  if (partialOrder.relation === 'right_dominates') return 1
  return 0
}
