import type {
  Applicability,
  Disc,
  SetFacts,
  GameRules,
  Profile,
  Cutoffs,
  QualityPolicy,
  QualityEvidence,
} from './absoluteDiscRetentionContract'
import { enrichRetentionEvidence, fixedQualityNormalization } from './absoluteDiscRetentionStages'
const finiteNonnegative = (x: number) => Number.isFinite(x) && x >= 0
const round = (x: number) => Math.round(x * 1e6) / 1e6
export const anyFit = (values: readonly Applicability[]): Applicability =>
  values.includes('valid')
    ? 'valid'
    : values.includes('conditional')
      ? 'conditional'
      : 'incompatible'
export const allFit = (values: readonly Applicability[]): Applicability =>
  values.includes('incompatible')
    ? 'incompatible'
    : values.includes('conditional')
      ? 'conditional'
      : 'valid'

/** Missing benefit evidence is unknown, NOT proof of no benefit. */
export function twoPieceApplicability(set: SetFacts, profile: Profile): Applicability {
  if (!set.verified || !set.sourceIds.length || !set.twoPieceEffects.length) return 'conditional'
  return anyFit(
    set.twoPieceEffects.map((effect) => {
      if (!Number.isFinite(effect.value) || effect.value <= 0) return 'conditional'
      const benefit =
        effect.stat === 'action_dmg_'
          ? !effect.actionTypes?.length
            ? 'conditional'
            : anyFit(
                effect.actionTypes.map(
                  (action) => profile.actionUtility?.[action] ?? 'conditional',
                ),
              )
          : (profile.effectUtility[effect.stat] ?? 'conditional')
      return allFit([
        benefit,
        ...(effect.requires ?? []).map((key) => profile.prerequisites?.[key] ?? 'conditional'),
      ])
    }),
  )
}

/**
 * A set enters a recommendation only when its exact ID occurs in the profile's
 * sourced set plan and the role uses it in the corresponding main/secondary slot.
 * Effect utility by itself is not a recommendation.
 */
export function recommendationSetFit(
  profile: Profile,
  setId: string,
  twoPieceFit: Applicability,
  fourPieceFit: Applicability,
): Applicability {
  const plan = profile.branchSetPlan
  if (!plan) return 'conditional'
  if (plan.pattern === '4+2' || plan.pattern === '4+unconfirmed') {
    if (plan.primarySetIds.includes(setId))
      return allFit([profile.availability ?? 'valid', fourPieceFit])
    if (plan.secondarySetIds.includes(setId))
      return allFit([profile.availability ?? 'valid', twoPieceFit])
    if (plan.pattern === '4+unconfirmed' && twoPieceFit === 'incompatible') return 'incompatible'
    return plan.pattern === '4+unconfirmed' ? 'conditional' : 'incompatible'
  }
  if (plan.pattern === '2+2+2' && plan.primarySetIds.includes(setId))
    return allFit([profile.availability ?? 'valid', twoPieceFit])
  return 'incompatible'
}
function validateRules(rules: GameRules): void {
  if (
    !rules.sourceIds.length ||
    !Number.isInteger(rules.enhancementInterval) ||
    rules.enhancementInterval <= 0 ||
    !Number.isInteger(rules.maxSubStats) ||
    rules.maxSubStats < 1 ||
    rules.maxSubStats > 4
  )
    throw new Error('invalid_game_rules')
  const standard = rules.rarities[rules.standardRarity]
  if (!standard || !Object.keys(standard.steps).length) throw new Error('missing_standard_rarity')
  for (const native of Object.values(rules.rarities)) {
    if (
      !Number.isInteger(native.maxLevel) ||
      native.maxLevel <= 0 ||
      !native.initialLineCounts.length ||
      native.initialLineCounts.some(
        (n) => !Number.isInteger(n) || n < 1 || n > rules.maxSubStats,
      ) ||
      !Object.keys(native.steps).length ||
      Object.entries(native.steps).some(
        ([s, n]) => !Number.isFinite(n) || n <= 0 || !standard.steps[s],
      )
    )
      throw new Error('invalid_rarity_rules')
  }
}
export function history(disc: Disc, rules: GameRules) {
  validateRules(rules)
  const native = rules.rarities[disc.rarity]
  if (
    !disc.id ||
    !disc.setId ||
    !native ||
    !Number.isInteger(disc.slot) ||
    !Number.isInteger(disc.level) ||
    disc.level < 0 ||
    disc.level > native.maxLevel ||
    !rules.mainStatsBySlot[String(disc.slot)]?.includes(disc.mainStat)
  )
    throw new Error('invalid_disc_identity_or_main')
  const lines = disc.subStats
  if (
    !lines.length ||
    lines.length > rules.maxSubStats ||
    new Set(lines.map((s) => s.stat)).size !== lines.length
  )
    throw new Error('invalid_substat_lines')
  for (const line of lines) {
    const step = native.steps[line.stat]
    if (
      !step ||
      line.stat === disc.mainStat ||
      !Number.isInteger(line.upgrades) ||
      line.upgrades < 0 ||
      !Number.isFinite(line.value) ||
      Math.abs(line.value / step - line.upgrades - 1) > 0.05
    )
      throw new Error('inconsistent_substat_record')
  }
  const spent = Math.floor(disc.level / rules.enhancementInterval)
  const upgrades = lines.reduce((sum, line) => sum + line.upgrades, 0)
  const initial = lines.length + upgrades - spent
  if (
    !native.initialLineCounts.includes(initial) ||
    lines.length !== Math.min(rules.maxSubStats, initial + spent)
  )
    throw new Error('inconsistent_enhancement_history')
  const remainingNodes = Math.floor(native.maxLevel / rules.enhancementInterval) - spent
  const unlocks = Math.min(rules.maxSubStats - lines.length, remainingNodes)
  return { native, remainingNodes, unlocks, upgradesRemaining: remainingNodes - unlocks }
}
function combinations<T>(values: readonly T[], count: number): T[][] {
  if (!count) return [[]]
  const result: T[][] = []
  for (let i = 0; i <= values.length - count; i++)
    for (const rest of combinations(values.slice(i + 1), count - 1))
      result.push([values[i]!, ...rest])
  return result
}
export function profileValid(profile: Profile, rules: GameRules) {
  return (
    profile.verified &&
    profile.sourceIds.length > 0 &&
    Boolean(profile.id && profile.agentId) &&
    Object.entries(profile.weights).every(
      ([stat, w]) =>
        finiteNonnegative(w) &&
        w <= 1 &&
        Boolean(rules.rarities[rules.standardRarity]?.steps[stat]),
    ) &&
    (Object.values(profile.weights).some((w) => w > 0) ||
      (profile.goal === 'functional' &&
        profile.weightEvidence?.method === 'source_proven_no_functional_substat_goal' &&
        Object.keys(profile.weights).length === 0)) &&
    !(profile.functionalMains ?? []).some((entry) => entry.slot < 4 || !entry.sourceId)
  )
}
function validCutoffs(x: Cutoffs | undefined): x is Cutoffs {
  return Boolean(
    x &&
    Number.isFinite(x.cleanupBelow) &&
    Number.isFinite(x.keepFrom) &&
    Number.isFinite(x.premiumFrom) &&
    x.cleanupBelow > 0 &&
    x.cleanupBelow <= x.keepFrom &&
    x.keepFrom <= x.premiumFrom &&
    x.premiumFrom <= 100,
  )
}
function scorePreparedProfile(
  disc: Disc,
  profile: Profile,
  set: SetFacts | undefined,
  rules: GameRules,
  policy: QualityPolicy,
  h: ReturnType<typeof history>,
  possibleUnlocks: readonly string[][],
  normalization: ReturnType<typeof fixedQualityNormalization>,
): QualityEvidence {
  const standard = rules.rarities[rules.standardRarity]!
  // Fixed per role/slot rules, never adjusted to this disc's initial 3/4 lines or the inventory.
  const { maximumRaw } = normalization
  const noSubstatGoal =
    profile.goal === 'functional' &&
    profile.weightEvidence?.method === 'source_proven_no_functional_substat_goal' &&
    Object.keys(profile.weights).length === 0
  if (maximumRaw <= 0 && !noSubstatGoal) throw new Error('no_scoreable_legal_substats')
  const asScore = (raw: number) =>
    noSubstatGoal ? 0 : Math.min(100, Math.max(0, (raw / maximumRaw) * 100))
  const contributors = disc.subStats.map((line) => {
    const standardRollUnits = line.value / standard.steps[line.stat]!
    const weight = profile.weights[line.stat] ?? 0
    return {
      stat: line.stat,
      standardRollUnits: round(standardRollUnits),
      weight,
      points: round(asScore(standardRollUnits * weight)),
    }
  })
  const raw = disc.subStats.reduce(
    (sum, line) =>
      sum + (line.value / standard.steps[line.stat]!) * (profile.weights[line.stat] ?? 0),
    0,
  )
  if (!possibleUnlocks.length) throw new Error('incomplete_legal_substat_pool')
  let lower = Infinity,
    upper = -Infinity
  const increment = (stat: string) =>
    (h.native.steps[stat]! / standard.steps[stat]!) * (profile.weights[stat] ?? 0)
  // Only unlocked lines change between branches. Keep the observed lines' bounds once.
  const observedIncrements = disc.subStats.map((line) => increment(line.stat))
  const observedMinimum = Math.min(...observedIncrements)
  const observedMaximum = Math.max(...observedIncrements)
  for (const unlocks of possibleUnlocks) {
    let unlockedRaw = 0
    let minimum = observedMinimum
    let maximum = observedMaximum
    for (const stat of unlocks) {
      const value = increment(stat)
      unlockedRaw += value
      minimum = Math.min(minimum, value)
      maximum = Math.max(maximum, value)
    }
    const afterUnlock = raw + unlockedRaw
    lower = Math.min(lower, afterUnlock + h.upgradesRemaining * minimum)
    upper = Math.max(upper, afterUnlock + h.upgradesRemaining * maximum)
  }
  const mainFit = allFit([
    disc.slot <= 3
      ? 'valid'
      : (profile.mainStatsBySlot[String(disc.slot)]?.[disc.mainStat] ?? 'conditional'),
    profile.mainAvailability ?? 'valid',
  ])
  const twoPieceFit = set ? twoPieceApplicability(set, profile) : 'conditional'
  const fourPieceFit = profile.fourPieceUses?.[disc.setId] ?? 'incompatible'
  // Effect utility only: setFit does not prove a complete six-disc composition,
  // a second copy of this set, or that any set effect is currently active.
  const setFit = anyFit([twoPieceFit, allFit([profile.availability ?? 'valid', fourPieceFit])])
  const recommendationFit = recommendationSetFit(profile, disc.setId, twoPieceFit, fourPieceFit)
  const cutoffs = policy.byProfile[profile.id]?.[String(disc.slot)]
  return {
    profileId: profile.id,
    agentId: profile.agentId,
    sourceIds: [...profile.sourceIds, ...(set?.sourceIds ?? [])],
    ...(profile.branchSetPlan ? { branchSetPlan: profile.branchSetPlan } : {}),
    mainFit,
    setFit,
    recommendationSetFit: recommendationFit,
    twoPieceFit,
    fourPieceFit,
    currentScore: asScore(raw),
    weightedRollUnits: raw,
    maximumRaw,
    possibleFinalScore: { lower: asScore(lower), upper: asScore(upper) },
    expectedScore: null,
    functionalMain:
      mainFit !== 'incompatible' &&
      (profile.functionalMains ?? []).some(
        (entry) => entry.slot === disc.slot && entry.stat === disc.mainStat,
      ),
    cutoffs: validCutoffs(cutoffs) ? cutoffs : null,
    contributors,
    ...enrichRetentionEvidence({
      disc,
      profile,
      set,
      rules,
      policy,
      mainFit,
      twoPieceFit,
      fourPieceFit,
      setFit,
      recommendationSetFit: recommendationFit,
      currentScore: asScore(raw),
      possibleUpper: asScore(upper),
      remainingNodes: h.remainingNodes,
      remainingUnlocks: h.unlocks,
      normalizationInputStats: normalization.inputStats,
    }),
  }
}

/** Scope normalization reuse to one assessment's rule and profile objects. */
export function createRetentionProfileScorer(rules: GameRules) {
  const normalizations = new Map<
    Profile,
    Map<string, ReturnType<typeof fixedQualityNormalization>>
  >()
  return (disc: Disc) => {
    const enhancementHistory = history(disc, rules)
    const unseenStats = Object.keys(enhancementHistory.native.steps).filter(
      (stat) => stat !== disc.mainStat && !disc.subStats.some((line) => line.stat === stat),
    )
    const possibleUnlocks = combinations(unseenStats, enhancementHistory.unlocks)
    return (profile: Profile, set: SetFacts | undefined, policy: QualityPolicy) => {
      let byMain = normalizations.get(profile)
      if (!byMain) {
        byMain = new Map()
        normalizations.set(profile, byMain)
      }
      let normalization = byMain.get(disc.mainStat)
      if (!normalization) {
        normalization = fixedQualityNormalization(profile, rules, disc.mainStat)
        byMain.set(disc.mainStat, normalization)
      }
      return scorePreparedProfile(
        disc,
        profile,
        set,
        rules,
        policy,
        enhancementHistory,
        possibleUnlocks,
        normalization,
      )
    }
  }
}

export function scoreProfile(
  disc: Disc,
  profile: Profile,
  set: SetFacts | undefined,
  rules: GameRules,
  policy: QualityPolicy,
): QualityEvidence {
  return createRetentionProfileScorer(rules)(disc)(profile, set, policy)
}
