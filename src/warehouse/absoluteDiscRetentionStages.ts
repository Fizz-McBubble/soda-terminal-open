import type {
  Applicability,
  Disc,
  GameRules,
  Profile,
  QualityPolicy,
  RetentionBlocker,
  SetFacts,
} from './absoluteDiscRetentionContract'
import { noFunctionalSubstatGoalMethod } from './absoluteDiscRetentionContract'

/** Named dependencies are returned in full, rather than hidden behind the top three scores. */
export function enrichRetentionEvidence(input: {
  disc: Disc
  profile: Profile
  set: SetFacts | undefined
  rules: GameRules
  policy: QualityPolicy
  mainFit: Applicability
  twoPieceFit: Applicability
  fourPieceFit: Applicability
  setFit: Applicability
  currentScore: number
  possibleUpper: number
  remainingNodes: number
}) {
  const { disc, profile, set, rules, policy, mainFit, twoPieceFit, fourPieceFit, setFit } = input
  const native = rules.rarities[disc.rarity]!
  const blockers: RetentionBlocker[] = []
  const add = (
    field: string,
    predicateId: string,
    detail: string,
    knownCondition = false,
    sourceIds = profile.sourceIds,
  ) => {
    blockers.push({
      profileId: profile.id,
      agentId: profile.agentId,
      field,
      predicateId,
      detail,
      kind: knownCondition ? 'conditional_use' : 'missing_fact',
      sourceIds,
    })
  }
  const applicable = mainFit !== 'incompatible' && setFit !== 'incompatible'
  if (applicable) {
    for (const [stat, fact] of Object.entries(profile.qualityInputEvidence ?? {})) {
      const contributes =
        (profile.weights[stat] ?? 0) > 0 &&
        (disc.subStats.some((line) => line.stat === stat) ||
          (input.remainingNodes > 0 && disc.mainStat !== stat && Boolean(native.steps[stat])))
      if (contributes && ['conditional', 'missing_fact'].includes(fact.state))
        add(
          `qualityInput.${stat}`,
          fact.predicateId,
          fact.detail,
          fact.state === 'conditional',
          fact.evidenceIds,
        )
    }
    if (mainFit === 'conditional') {
      if (profile.mainAvailability === 'conditional' && profile.conditionEvidence?.length)
        for (const fact of profile.conditionEvidence)
          add(
            `mainStats.${disc.slot}.${disc.mainStat}`,
            fact.predicateId,
            fact.detail,
            fact.state === 'conditional',
            fact.evidenceIds,
          )
      else
        add(
          `mainStats.${disc.slot}.${disc.mainStat}`,
          `${profile.id}:main:${disc.slot}:${disc.mainStat}`,
          `该构筑尚未闭合 ${disc.slot} 号位 ${disc.mainStat} 的主词用途。`,
        )
    }
    if (setFit === 'conditional') {
      if (twoPieceFit === 'conditional') {
        for (const effect of set?.twoPieceEffects ?? []) {
          const keys =
            effect.stat === 'action_dmg_'
              ? (effect.actionTypes ?? []).map((action) => `action:${action}`)
              : [effect.stat]
          for (const key of keys) {
            const fact = profile.utilityEvidence?.[key]
            const fit = key.startsWith('action:')
              ? profile.actionUtility?.[key.slice(7)]
              : profile.effectUtility[key]
            if (fit === 'valid' || fit === 'incompatible') continue
            add(
              `twoPiece.${key}`,
              fact?.predicateId ?? `${profile.id}:two-piece:${key}`,
              fact?.detail ?? `缺少该构筑对两件效果 ${key} 的有效或无关证据。`,
              fact?.state === 'conditional',
              fact?.evidenceIds ?? profile.sourceIds,
            )
          }
          for (const key of effect.requires ?? []) {
            if (
              profile.prerequisites?.[key] === 'valid' ||
              profile.prerequisites?.[key] === 'incompatible'
            )
              continue
            add(
              `twoPiece.requires.${key}`,
              `${profile.id}:requires:${key}`,
              `核对两件效果的前提：${key}。`,
            )
          }
        }
        if (!set?.verified || !set.sourceIds.length || !set.twoPieceEffects.length)
          add(
            'set.twoPieceEffects',
            `set:${disc.setId}:two-piece`,
            '该套装的两件效果来源尚未闭合。',
            false,
            set?.sourceIds ?? [],
          )
      }
      if (fourPieceFit === 'conditional') {
        const conditions = profile.conditionEvidence ?? []
        if (!conditions.length)
          add(
            `fourPiece.${disc.setId}`,
            `${profile.id}:four-piece:${disc.setId}`,
            '该四件构筑缺少具名的触发或队伍前提。',
          )
        else
          for (const condition of conditions)
            add(
              `fourPiece.${disc.setId}`,
              condition.predicateId,
              condition.detail,
              condition.state === 'conditional',
              condition.evidenceIds,
            )
      }
    }
    if (profile.weightEvidence?.method === 'uncalibrated_direction_only')
      add(
        'numericWeights',
        profile.weightEvidence.id,
        '来源只声明属性方向；该目标的数值品质标尺尚未校准。',
      )
  }
  const functional =
    mainFit !== 'incompatible'
      ? profile.functionalMains?.find(
          (entry) => entry.slot === disc.slot && entry.stat === disc.mainStat,
        )
      : undefined
  const functionalState = !functional
    ? ('none' as const)
    : functional.completion !== 'main_only'
      ? ('needs_build_context' as const)
      : disc.level === native.maxLevel
        ? ('ready' as const)
        : ('needs_level' as const)
  const functionDetail =
    functional?.detail ?? (functional ? '需要核对该主词在完整构筑中的功能目标。' : null)
  const investment = policy.investment
  const spentNodes = Math.floor(disc.level / rules.enhancementInterval)
  const meaningfulStats = disc.subStats
    .filter(
      (line) => (profile.weights[line.stat] ?? 0) >= (investment?.meaningfulWeightFrom ?? 0.5),
    )
    .map((line) => line.stat)
  const coreStats = meaningfulStats.filter((stat) => profile.coreStats?.includes(stat))
  const configured =
    investment?.calibration === 'approved' &&
    profile.goal &&
    profile.goal !== 'unknown' &&
    Boolean(profile.coreStats?.length) &&
    investment.minimumCoreLines > 0 &&
    investment.leftSlotMinimumLines > 0 &&
    investment.rightSlotMinimumLines > 0 &&
    investment.meaningfulWeightFrom > 0 &&
    investment.meaningfulWeightFrom <= 1
  const cutoffs = policy.byProfile[profile.id]?.[String(disc.slot)]
  const floorFraction = investment?.progressFloorBySpentNode[String(spentNodes)]
  const progressFloor =
    configured &&
    cutoffs &&
    floorFraction !== undefined &&
    Number.isFinite(floorFraction) &&
    floorFraction >= 0 &&
    floorFraction <= 1
      ? cutoffs.cleanupBelow * floorFraction
      : null
  const minimumLines =
    disc.slot <= 3 ? investment?.leftSlotMinimumLines : investment?.rightSlotMinimumLines
  const potentialTarget =
    functionalState === 'needs_level' || functionalState === 'ready'
      ? null
      : investment && cutoffs
        ? cutoffs[investment.growthTarget]
        : null
  const noSubstatInvestmentGoal =
    profile.verified &&
    profile.sourceIds.length > 0 &&
    profile.goal === 'functional' &&
    profile.weightEvidence?.method === noFunctionalSubstatGoalMethod &&
    profile.weightEvidence.sourceIds.length > 0 &&
    Object.keys(profile.weights).length === 0 &&
    !profile.coreStats?.length &&
    functionalState === 'none'
  const qualified = !input.remainingNodes
    ? false
    : functionalState === 'needs_level'
      ? true
      : noSubstatInvestmentGoal
        ? false
        : configured && progressFloor !== null
          ? meaningfulStats.length >= minimumLines! &&
            coreStats.length >= investment!.minimumCoreLines &&
            input.currentScore + 1e-8 >= progressFloor &&
            potentialTarget !== null &&
            input.possibleUpper + 1e-8 >= potentialTarget
          : null
  return {
    functionalState,
    functionDetail,
    useState: !applicable
      ? ('incompatible' as const)
      : blockers.some((row) => row.kind === 'missing_fact')
        ? ('missing_fact' as const)
        : blockers.length
          ? ('conditional' as const)
          : ('valid' as const),
    blockers,
    weightEvidence: profile.weightEvidence ?? null,
    investment: {
      policyId: investment?.id ?? null,
      qualified,
      meaningfulStats,
      coreStats,
      spentNodes,
      remainingNodes: input.remainingNodes,
      nextLevel: input.remainingNodes
        ? Math.min(native.maxLevel, (spentNodes + 1) * rules.enhancementInterval)
        : null,
      progressFloor,
      potentialTarget,
    },
  }
}
