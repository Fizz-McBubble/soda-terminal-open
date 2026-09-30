import type { AccountPlanningDraft } from '../accounts/types'
import type { AccountRoster } from '../assault/types'
import { driveDiscData } from '../data/gameData'
import type { DriveDisc, StatKey } from '../domain/schemas'
import { evaluationRules } from '../evaluation/rules'
import {
  deriveSubStatHistory,
  describeInitialSubStats,
  type SubStatHistory,
} from '../evaluation/subStatHistory'
import { getCurrentScopeEntry } from '../gameDataPacks/currentScopeManifest'
import { type DiscEnhancementPotential } from './discEnhancementPotential'
import type {
  Decision as AbsoluteRetentionDecision,
  QualityEvidence,
} from './absoluteDiscRetentionKernel'

export type WarehouseAbsoluteRetentionEvidence = {
  disposition: AbsoluteRetentionDecision['qualityDisposition']
  policyId: string
  policyCalibration: 'candidate' | 'approved'
  sourceCoverage: 'complete' | 'partial'
  branchCount: number
  bestUseProfileId: string | null
  bestUseScore: number | null
  ownedUseAgentIds: string[]
  unownedUseAgentIds: string[]
  reasonKind?: AbsoluteRetentionDecision['reasonKind']
  nextAction?: AbsoluteRetentionDecision['nextAction']
  blockedBy?: AbsoluteRetentionDecision['blockedBy']
  witnessProfileIds?: AbsoluteRetentionDecision['witnessProfileIds']
  reviewedUseScope?: AbsoluteRetentionDecision['reviewedUseScope']
  leadingUses: Array<
    Pick<
      QualityEvidence,
      | 'profileId'
      | 'agentId'
      | 'mainFit'
      | 'setFit'
      | 'twoPieceFit'
      | 'fourPieceFit'
      | 'currentScore'
      | 'possibleFinalScore'
      | 'functionalMain'
      | 'cutoffs'
      | 'sourceIds'
    > &
      Partial<
        Pick<
          QualityEvidence,
          | 'useState'
          | 'functionalState'
          | 'functionDetail'
          | 'investment'
          | 'weightEvidence'
          | 'blockers'
        >
      >
  >
}

export type WarehouseDiscCategory =
  | 'account_premium'
  | 'current_plan_key'
  | 'targeted_keep'
  | 'enhance_watch'
  | 'replaceable'
  | 'cleanup_candidate'

export const warehouseCategoryLabels: Record<WarehouseDiscCategory, string> = {
  account_premium: '账号极品（徽标）',
  current_plan_key: '当前方案关键盘',
  targeted_keep: '定向保留',
  enhance_watch: '待强化观察',
  replaceable: '可替代',
  cleanup_candidate: '清理复核候选',
}

export type WarehouseDiscDecision = {
  discId: string
  category: WarehouseDiscCategory
  absoluteRetention?: WarehouseAbsoluteRetentionEvidence
  useAssessment?: import('./warehouseUseAssessment').WarehouseUseAssessment
  reviewDirection?: 'no_current_fit'
  reasons: string[]
  fitAgentIds: string[]
  planIds: string[]
  activePlanIds: string[]
  alternatives: string[]
  badges: Array<'account_premium'>
  subStatHistory: SubStatHistory
  enhancementPotential: DiscEnhancementPotential
  cleanupSafety: {
    /** Explicit saved player intent; independent of absolute quality and current equipment. */
    favorite?: boolean
    equipped: boolean
    referenced: boolean
    activePlanReferenced: boolean
    savedPlanReferenced: boolean
    portfolioReferenced: boolean
    protectedDemandCount: number
    protectedDemandCoverageComplete: boolean
    protectedDemandReferencesResolved: boolean
    physicalCopyCount: number
    availableCopiesAfterDelete: number
    deleteAfterFeasible: boolean
    hasBetterAlternative: boolean
    hasCoverageAlternative: boolean
    rareUnique: boolean
    scarceReserve?: boolean
    premiumReserve?: boolean
    significantFit: boolean
    alternativeSafe: boolean
    complete: boolean
    potentialEvaluated: boolean
    optimisticCeilingDominated: boolean
    noCurrentAccountFit: boolean
    nonViableEmbryo: boolean
    badEmbryoCleanupSafe: boolean
    cleanupEvidenceComplete: boolean
    adoptedSetIdentity: boolean
  }
  strength: 'candidate' | 'limited'
}

export type WarehouseAnalysisSnapshot = {
  accountId: string
  ruleVersion: string
  dataVersion: string
  assetSnapshot: string
  planSnapshot: string
  createdAt: string
  decisions: WarehouseDiscDecision[]
  affectedPlanIds: string[]
  counts: Record<WarehouseDiscCategory, number>
  referenceIssues?: {
    savedPlanIds: string[]
    equipmentNeedsReview: boolean
    simultaneousNeedsReview: boolean
  }
}

export type WarehouseAnalysisInput = {
  accountId: string
  discs: DriveDisc[]
  roster: AccountRoster
  drafts: AccountPlanningDraft[]
  activePlanIds?: Readonly<Record<string, string | null | undefined>>
  priorityAgentIds?: readonly string[]
  selectedTeamAgentIds?: readonly (readonly string[])[]
  protectedSimultaneousDemands?: Array<{ id: string; discIds: string[] }>
  protectedDemandCoverageComplete?: boolean
  now?: string
  dataVersion?: string
}

const setName = new Map((driveDiscData?.driveDiscSets ?? []).map((item) => [item.id, item.name]))

export function discQuality(disc: DriveDisc) {
  const weightedRolls = disc.subStats.reduce(
    (total, item) =>
      total + (evaluationRules.stats[item.stat]?.genericWeight ?? 0) * (item.upgrades + 1),
    0,
  )
  return Math.round((disc.level * 2 + weightedRolls * 12) * 100) / 100
}

function isScarceMainStat(disc: DriveDisc) {
  return (
    disc.slot >= 4 &&
    [
      'crit_rate',
      'crit_dmg',
      'anomaly_proficiency',
      'pen_ratio',
      'impact',
      'anomaly_mastery',
      'energy_regen',
      'physical_dmg',
      'fire_dmg',
      'ice_dmg',
      'electric_dmg',
      'ether_dmg',
      'wind_dmg',
    ].includes(disc.mainStat)
  )
}

export function isRareUnique(disc: DriveDisc, all: DriveDisc[]) {
  return (
    isScarceMainStat(disc) &&
    all.filter(
      (other) =>
        other.setId === disc.setId && other.slot === disc.slot && other.mainStat === disc.mainStat,
    ).length === 1
  )
}

/** Keep a stable physical reserve even when multiple surplus copies are reviewed together. */
export function scarceReserveDiscIds(all: DriveDisc[], protectedIds: ReadonlySet<string>) {
  const groups = new Map<string, DriveDisc[]>()
  for (const disc of all) {
    if (!isScarceMainStat(disc)) continue
    const key = `${disc.setId}|${disc.slot}|${disc.mainStat}`
    const peers = groups.get(key) ?? []
    peers.push(disc)
    groups.set(key, peers)
  }
  const reserved = new Set<string>()
  for (const peers of groups.values()) {
    const protectedPeers = peers.filter((disc) => protectedIds.has(disc.id))
    if (protectedPeers.length) {
      for (const disc of protectedPeers) reserved.add(disc.id)
      continue
    }
    const best = peers
      .map((disc) => ({
        id: disc.id,
        known: Number(deriveSubStatHistory(disc).status === 'known'),
        premium: Number(isPremiumReserve(disc)),
        quality: discQuality(disc),
      }))
      .sort(
        (left, right) =>
          right.known - left.known ||
          right.premium - left.premium ||
          right.quality - left.quality ||
          left.id.localeCompare(right.id),
      )[0]
    if (best) reserved.add(best.id)
  }
  return reserved
}

/** Reserve quality without pretending an unowned agent is current demand. */
export function isPremiumReserve(disc: DriveDisc) {
  const history = deriveSubStatHistory(disc)
  if (history.status !== 'known') return false
  const highValue = disc.subStats.filter(
    (line) => (evaluationRules.stats[line.stat]?.genericWeight ?? 0) >= 0.8,
  )
  const hits = highValue.reduce((sum, line) => sum + line.upgrades + 1, 0)
  const dualCrit =
    highValue.some((line) => line.stat === 'crit_rate') &&
    highValue.some((line) => line.stat === 'crit_dmg')
  return (
    hits >= 5 || (history.remainingRollOpportunities >= 3 && (dualCrit || highValue.length >= 3))
  )
}

function readableSet(disc: DriveDisc) {
  const currentSet = getCurrentScopeEntry(disc.setId)
  if (currentSet?.domain === 'drive_disc_set') return currentSet.displayName
  return setName.get(disc.setId) ?? '资料待补齐套装'
}

/**
 * Cleanup needs a current-version adopted identity, not only an opaque ID that generic scoring can compare.
 * A released scope identity absent from the legacy manifest is intentionally accepted here: that establishes
 * only that the set ID is real and account-ownable. It does not promote its effects or fit to formal;
 * the independent profile-coverage, enhancement, replacement, and existing cleanup gates still apply.
 */
export function hasAdoptedCurrentSetIdentity(setId: string) {
  const scope = getCurrentScopeEntry(setId)
  if (
    !scope ||
    scope.domain !== 'drive_disc_set' ||
    scope.releaseState !== 'released' ||
    !scope.accountOwnable
  )
    return false
  const adopted = driveDiscData?.driveDiscSets.find((set) => set.id === setId)
  // A legacy row marked evidence-only overrides scope identity for cleanup. No legacy row means this gate
  // relies only on the current released identity above, rather than inventing effect authority.
  return !adopted?.evidenceOnly
}

function statLabel(stat: StatKey) {
  return evaluationRules.stats[stat]?.label ?? '资料待补齐词条'
}

export function hasIdenticalStats(left: DriveDisc, right: DriveDisc) {
  return (
    left.setId === right.setId &&
    left.slot === right.slot &&
    left.mainStat === right.mainStat &&
    left.level === right.level &&
    (left.rarity ?? 'S') === (right.rarity ?? 'S') &&
    left.subStats.length === right.subStats.length &&
    left.subStats.every((line) =>
      right.subStats.some(
        (other) =>
          line.stat === other.stat &&
          line.value === other.value &&
          line.upgrades === other.upgrades,
      ),
    )
  )
}

export function safeReasons(input: {
  disc: DriveDisc
  fitAgentIds: string[]
  planIds: string[]
  category: WarehouseDiscCategory
  subStatHistory: SubStatHistory
  potential: DiscEnhancementPotential
  identicalFullAlternative?: boolean
  premiumReserve?: boolean
  scarceReserve?: boolean
  useAssessment?: import('./warehouseUseAssessment').WarehouseUseAssessment
  reviewDirection?: 'no_current_fit'
}) {
  const { disc, fitAgentIds, planIds, category, subStatHistory, potential } = input
  const baseline = [`${readableSet(disc)} ${disc.slot} 号位 · ${statLabel(disc.mainStat)}`]
  const historyReason = describeInitialSubStats(subStatHistory, disc.level)
  const potentialReasons = (() => {
    if (!potential.potentialEvaluated) return ['强化历史或角色约束不足，缺少可证潜力上限']
    const remaining = `剩余 ${potential.remainingEnhancementNodes ?? 0} 个强化节点（${potential.unlocksRemaining ?? 0} 个用于补第4词条，${potential.remainingRollOpportunities ?? 0} 次可继续强化）`
    const viability =
      potential.communityViable === null
        ? []
        : [
            `按当前角色有效词条计算，最乐观可达 ${potential.maxOptimisticEffectiveRolls ?? 0}，本号位保留线为 ${potential.communityMinimumEffectiveRolls ?? 0}`,
          ]
    const knownMisses = potential.knownNonTargetRolls
      ? [`按适配角色计算，至少有 ${potential.knownNonTargetRolls} 次无效词条强化`]
      : []
    if (potential.optimisticCeilingDominated) {
      return [
        remaining,
        ...viability,
        ...knownMisses,
        '即使剩余强化全部命中最有利词条，也无法超过同一张现有替代盘，且至少一个适配方向更弱',
      ]
    }
    if (input.identicalFullAlternative) {
      return [remaining, '已有各项属性相同的满级实体盘；本盘没有剩余强化机会']
    }
    if (
      potential.coverageAlternativeIds.length > 0 &&
      potential.remainingRollOpportunities === 0 &&
      (potential.knownNonTargetRolls ?? 0) > 0
    ) {
      return [
        remaining,
        ...viability,
        ...knownMisses,
        '已有等价实体盘覆盖当前角色维度，且本盘没有剩余强化机会',
      ]
    }
    if (potential.reason === 'no_alternative') {
      return [
        remaining,
        ...viability,
        ...knownMisses,
        potential.communityViable === false
          ? '即使后续强化全部命中有效词条，也达不到本号位的保留线'
          : '没有同类替代盘，暂不能确认这张盘是否值得清理',
      ]
    }
    if (potential.remainingRollOpportunities === 0) {
      return [
        remaining,
        ...viability,
        ...knownMisses,
        '已无剩余强化机会；暂未找到能完整替代这张盘的现有驱动盘。',
      ]
    }
    return [
      remaining,
      ...viability,
      ...knownMisses,
      '剩余强化仍有提升空间，结合当前用途决定是否投入',
    ]
  })()
  if (input.reviewDirection === 'no_current_fit') return [historyReason, ...baseline]
  if (category === 'current_plan_key') {
    return [
      historyReason,
      '被当前装备、长期激活方案或显式多队组合引用；不建议拆分。',
      ...potentialReasons,
      ...baseline,
    ]
  }
  if (category === 'targeted_keep') {
    return [
      historyReason,
      planIds.length
        ? `已被 ${planIds.length} 份当前方案引用`
        : fitAgentIds.length
          ? `仍适合当前账号 ${fitAgentIds.length} 名代理人，现有替代盘不能完全覆盖这些用途`
          : input.scarceReserve
            ? '保留一张稀缺主词条盘，避免清空这一类选择。'
            : input.premiumReserve
              ? '保留优质通用胚子，可供后续配装。'
              : '这是当前仓库中同套装、号位和主词条的唯一一张盘，先保留以免失去这一类选择',
      ...potentialReasons,
      ...baseline,
    ]
  }
  if (category === 'cleanup_candidate') {
    const cleanupBasis = input.identicalFullAlternative
      ? '已有各项属性相同的满级实体盘；本盘没有剩余强化机会'
      : potential.usedGenericFallback
        ? '当前账号没有套装、号位与主词条均兼容的用途'
        : potential.communityViable === false
          ? '即使把剩余强化全部计作有效命中，也达不到本号位的保留线'
          : '同一张同套装、号位与主词条实体替代盘覆盖全部当前角色维度'
    return [
      historyReason,
      ...potentialReasons,
      '未记录为当前实装，也未被长期激活或保存方案引用；实际装备状态需在游戏内核对',
      `${cleanupBasis}；仅供人工复核`,
    ]
  }
  if (category === 'replaceable') {
    if (potential.investmentStopReason)
      return [
        historyReason,
        potential.investmentStopReason === 'poor_seed'
          ? '基础号位有效词条较少，已有满级同类盘覆盖当前账号用途'
          : '至少两次强化未命中有效词条，当前有效命中不超过三次，已有满级同类替代',
        '建议停止投入，可考虑清理',
        ...baseline,
      ]
    if (potential.developmentAlternativeIds?.length)
      return [
        historyReason,
        '已有同等级、同副词条种类的培养胚子，在全部适配角色方向不弱于本盘，且后续强化机会相同',
        '优先培养替代盘，本盘可暂停投入并复核冗余；不必同时培养重复胚子',
        '实际随机强化可能出现不同结果；此建议不是满级替代或可直接清理的证明',
        ...baseline,
      ]
    const stopInvestmentSignal = potential.candidateAlternativeIds.length
      ? '当前已有同套装、号位与主词条的实体盘，在全部适用维度的当前结果严格更好'
      : `至少有 ${potential.knownNonTargetRolls ?? 0} 次无效词条强化，且没有当前独特角色覆盖`
    return [
      historyReason,
      stopInvestmentSignal,
      '当前已有更合适选择，可停止投入并在游戏内确认是否清理',
      '仍可能存在理论强化上限；本建议只用于节省投入与人工清仓，不代表永久无用',
      ...baseline,
    ]
  }
  return [...baseline, historyReason, ...potentialReasons]
}
