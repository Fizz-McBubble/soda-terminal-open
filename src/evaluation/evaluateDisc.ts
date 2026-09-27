import { driveDiscSchema, type DriveDisc, type StatKey } from '../domain/schemas'
import { contentHash } from './contentHash'
import { buildPlayerReasons } from './presentation'
import { evaluationRuleContentHash, evaluationRules, getProfileContentHash } from './rules'
import { deriveSubStatHistory } from './subStatHistory'
import type {
  Conclusion,
  EvaluationProfile,
  EvaluationSnapshot,
  PotentialRange,
  ScoreContribution,
  ScoreResult,
} from './types'

type EvaluationOptions = {
  profile?: EvaluationProfile
  evaluatedAt?: string
}

function round(value: number, digits = 2) {
  const multiplier = 10 ** digits
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier
}

function normalize(rawScore: number, maximumRaw: number) {
  return round(Math.min(100, Math.max(0, (rawScore / maximumRaw) * 100)))
}

function assertKnownStats(input: unknown) {
  if (!input || typeof input !== 'object') return
  const subStats = (input as { subStats?: unknown }).subStats
  if (!Array.isArray(subStats)) return

  for (const subStat of subStats) {
    const stat = (subStat as { stat?: unknown }).stat
    if (typeof stat === 'string' && !(stat in evaluationRules.stats)) {
      throw new Error(`Unknown stat ${stat}`)
    }
  }
}

function validateDisc(input: DriveDisc) {
  assertKnownStats(input)
  const disc = driveDiscSchema.parse(input)
  const legalMainStats = evaluationRules.slots[String(disc.slot)] ?? []
  if (!legalMainStats.includes(disc.mainStat)) {
    throw new Error(`Illegal main stat ${disc.mainStat} for slot ${disc.slot}`)
  }
  if (!evaluationRules.enhancementNodes.includes(disc.level)) {
    throw new Error(`Unsupported enhancement level ${disc.level}`)
  }
  if (disc.subStats.length < 3) {
    throw new Error('A drive disc must expose three or four sub stats before evaluation')
  }
  if (disc.level > 0 && disc.subStats.length !== 4) {
    throw new Error('An enhanced drive disc must expose four sub stats')
  }

  const seen = new Set<StatKey>()
  for (const subStat of disc.subStats) {
    const rule = evaluationRules.stats[subStat.stat]
    if (!rule.subStat) throw new Error(`Stat ${subStat.stat} cannot be a sub stat`)
    if (subStat.stat === disc.mainStat)
      throw new Error(`Main stat ${disc.mainStat} cannot repeat as a sub stat`)
    if (seen.has(subStat.stat)) throw new Error(`Duplicate sub stat ${subStat.stat}`)
    seen.add(subStat.stat)

    const representedRolls = round(subStat.value / rule.rollUnit, 4)
    const expectedRolls = subStat.upgrades + 1
    if (Math.abs(representedRolls - expectedRolls) > 0.05) {
      throw new Error(`Sub stat ${subStat.stat} value does not match its upgrade count`)
    }
  }

  const subStatHistory = deriveSubStatHistory(disc)
  if (subStatHistory.status === 'unknown') throw new Error(subStatHistory.message)

  return disc
}

function contribution(
  source: ScoreContribution['source'],
  key: string,
  label: string,
  rawScore: number,
  weight: number,
  maximumRaw: number,
): ScoreContribution {
  return {
    source,
    key,
    label,
    rawScore: round(rawScore),
    normalizedScore: normalize(rawScore, maximumRaw),
    weight,
  }
}

function scoreQuality(disc: DriveDisc): ScoreResult {
  const maximumRaw = evaluationRules.componentMaximums.quality
  const contributions = disc.subStats.map((subStat) => {
    const rule = evaluationRules.stats[subStat.stat]
    return contribution(
      'sub_stat',
      subStat.stat,
      rule.label,
      (subStat.value / rule.rollUnit) * rule.genericWeight,
      rule.genericWeight,
      maximumRaw,
    )
  })
  const raw = round(
    Math.min(
      maximumRaw,
      contributions.reduce((sum, item) => sum + item.rawScore, 0),
    ),
  )

  return {
    raw,
    normalized: normalize(raw, maximumRaw),
    maximumRaw,
    contributions: contributions.sort((left, right) => right.rawScore - left.rawScore),
  }
}

function scoreFit(disc: DriveDisc, profile?: EvaluationProfile): ScoreResult {
  const {
    mainStat: mainMaximum,
    set: setMaximum,
    quality: subStatMaximum,
  } = evaluationRules.componentMaximums
  const includesProfileSubStats = Boolean(profile)
  const maximumRaw = mainMaximum + setMaximum + (includesProfileSubStats ? subStatMaximum : 0)
  const contributions: ScoreContribution[] = []

  if (profile) {
    for (const subStat of disc.subStats) {
      const rule = evaluationRules.stats[subStat.stat]
      const weight = profile.statWeights[subStat.stat] ?? 0
      contributions.push(
        contribution(
          'sub_stat',
          subStat.stat,
          rule.label,
          (subStat.value / rule.rollUnit) * weight,
          weight,
          maximumRaw,
        ),
      )
    }
  }

  const mainFit = profile
    ? (profile.mainStatFit[String(disc.slot)]?.[disc.mainStat] ?? 0)
    : evaluationRules.genericMainStatFit[disc.mainStat]
  contributions.push(
    contribution(
      'main_stat',
      disc.mainStat,
      `${evaluationRules.stats[disc.mainStat].label}主词条`,
      mainFit * mainMaximum,
      mainFit,
      maximumRaw,
    ),
  )

  const setFit = profile
    ? (profile.setFit[disc.setId] ?? 0)
    : (evaluationRules.genericSetFit[disc.setId] ?? 0)
  contributions.push(
    contribution('set', disc.setId, '套装适配', setFit * setMaximum, setFit, maximumRaw),
  )

  const raw = round(
    Math.min(
      maximumRaw,
      contributions.reduce((sum, item) => sum + item.rawScore, 0),
    ),
  )
  return {
    raw,
    normalized: normalize(raw, maximumRaw),
    maximumRaw,
    contributions: contributions.sort((left, right) => right.rawScore - left.rawScore),
  }
}

function calculatePotential(disc: DriveDisc, qualityScore: ScoreResult): PotentialRange {
  const history = deriveSubStatHistory(disc)
  if (history.status === 'unknown') throw new Error(history.message)
  const {
    remainingEnhancementNodes,
    unlocksRemaining,
    remainingRollOpportunities: scoreableEnhancements,
  } = history
  const weights = disc.subStats.map((subStat) => evaluationRules.stats[subStat.stat].genericWeight)
  while (weights.length < 4) weights.push(evaluationRules.potential.unknownSubStatWeight)
  const expectedWeight = weights.reduce((sum, weight) => sum + weight, 0) / weights.length
  const idealWeight = Math.max(...weights)

  return {
    remainingEnhancementNodes,
    unlocksRemaining,
    scoreableEnhancements,
    conservative: qualityScore.normalized,
    expected: normalize(
      qualityScore.raw + scoreableEnhancements * expectedWeight,
      qualityScore.maximumRaw,
    ),
    ideal: normalize(
      qualityScore.raw + scoreableEnhancements * idealWeight,
      qualityScore.maximumRaw,
    ),
    levelAtMaximum: 15,
  }
}

export function classifyConclusion(
  level: number,
  qualityScore: number,
  fitScore: number,
  potential: PotentialRange,
): Conclusion {
  const thresholds = evaluationRules.conclusionThresholds
  if (level < 15) {
    if (
      fitScore >= thresholds.unfinished.enhanceFit &&
      potential.expected >= thresholds.unfinished.enhanceExpectedQuality
    ) {
      return 'enhance'
    }
    if (
      fitScore >= thresholds.unfinished.observeFit &&
      potential.expected >= thresholds.unfinished.observeExpectedQuality
    ) {
      return 'observe'
    }
    return 'stop_enhancing'
  }

  if (
    qualityScore >= thresholds.completed.treasureQuality &&
    fitScore >= thresholds.completed.treasureFit
  ) {
    return 'treasure'
  }
  if (
    qualityScore >= thresholds.completed.keepQuality &&
    fitScore >= thresholds.completed.keepFit
  ) {
    return 'keep'
  }
  if (
    qualityScore >= thresholds.completed.conditionalQuality ||
    fitScore >= thresholds.completed.conditionalFit
  ) {
    return 'conditional_keep'
  }
  return 'low_priority'
}

export function evaluateDisc(
  input: DriveDisc,
  options: EvaluationOptions = {},
): EvaluationSnapshot {
  const disc = validateDisc(input)
  const qualityScore = scoreQuality(disc)
  const genericFitScore = scoreFit(disc)
  const profileFitScore = options.profile ? scoreFit(disc, options.profile) : null
  const selectedFitScore = profileFitScore ?? genericFitScore
  const potential = calculatePotential(disc, qualityScore)
  const subStatHistory = deriveSubStatHistory(disc)
  const conclusion = classifyConclusion(
    disc.level,
    qualityScore.normalized,
    selectedFitScore.normalized,
    potential,
  )
  const risks = ['质量分采用跨角色内部权重，不代表官方词条价值。']
  if (potential.remainingEnhancementNodes > 0) {
    risks.push('潜力区间是规则情景推演，不代表精确强化概率。')
  }
  if (!options.profile) {
    risks.push('通用适配不覆盖特殊生命、防御或机制型代理人。')
  }

  const snapshot: EvaluationSnapshot = {
    snapshotVersion: 4,
    evaluatedAt: options.evaluatedAt ?? new Date().toISOString(),
    ruleVersion: evaluationRules.ruleVersion,
    ruleSchemaVersion: evaluationRules.ruleSchemaVersion,
    ruleContentHash: evaluationRuleContentHash,
    gameVersion: evaluationRules.gameVersion,
    mode: options.profile ? 'profile' : 'generic',
    profileId: options.profile?.id ?? null,
    profileVersion: options.profile?.version ?? null,
    profileContentHash: options.profile ? getProfileContentHash(options.profile) : null,
    inputDataVersion: disc.dataVersion,
    inputContentHash: contentHash(disc),
    input: structuredClone(disc),
    subStatHistory,
    qualityScore,
    genericFitScore,
    profileFitScore,
    selectedFitScore,
    potential,
    conclusion,
    reasons: [],
    risks,
  }
  snapshot.reasons = buildPlayerReasons(snapshot)
  return snapshot
}
