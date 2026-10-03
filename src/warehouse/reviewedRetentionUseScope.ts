/**
 * Candidate product-use scope, separate from physical damage-tag evidence.
 * No account writes, disc scoring, inventory counts, or automatic cleanup.
 * The caller must explicitly adopt one reviewed build to an immutable profile.
 * Failure to match preserves the existing decision. Positive mechanical evidence
 * always wins; this helper NEVER changes an unresolved tag to a proven absence.
 */
import type { CandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import type { CurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { stableContentHash } from '../gameDataPacks/types'
import originalReviews from './reviewed-normal-use-scopes.json'
import normalAdoptions from './reviewed-normal-use-adoptions.v1.json'

export type ActionTag = 'basic' | 'dash' | 'aftershock'
export type UtilityState = 'valid' | 'conditional' | 'incidental' | 'incompatible' | 'missing_fact'
export interface Review {
  reviewId: string
  actorAgentId: string
  externalId: string
  gameVersion: string
  mode: 'standard_combat'
  buildKey: string
  goals: readonly string[]
  mindscapeRange: readonly number[]
  decision: string
  mechanicalPresence: string
  primaryAction: string | null
  summary: string
  excluded: string
  sources: readonly { url: string; locator: string }[]
  sourceArtifactSha256?: string
}
export interface Adoption {
  reviewId: string
  profileId: string
  /** A digest of the actual adopted constraint/rotation, not a display string. */
  profileFingerprint: string
  sourceCommit: string
  formulaSha256: string
  statsSha256: string
  buildKey: string
  /** False until the source-backed profile scope has been explicitly accepted. */
  approved: boolean
}
export interface Context {
  profileId: string
  profileFingerprint: string
  actorAgentId: string
  externalId: string
  gameVersion: string
  mode: 'standard_combat' | 'special_mode'
  goal: string
  /** Property of this reviewed build, NOT ownership used to change disc quality. */
  mindscape: number
  sourceCommit: string
  formulaSha256: string
  statsSha256: string
  modifiers: readonly string[]
}
export interface ExistingFact {
  action: ActionTag
  mechanicalPresence: 'present' | 'absent' | 'unresolved'
  utility: UtilityState
  predicateId: string
}
export interface ScopedResult extends ExistingFact {
  applied: boolean
  useReviewId: string | null
  explanation: string
  evidenceUrls: string[]
}

/** Explicit reserve objective policy, never an account or special-mode observation. */
export function getReviewedNormalM0UseScope(
  constraint: CandidateWarehouseConstraint,
  actorAgentId: string,
  goal: string,
  contract: CurrentAgentEventContract | null,
): { context: Context; review: Review; adoption: Adoption } | undefined {
  const { contentHash, ...payload } = constraint
  const actualFingerprint = stableContentHash(payload)
  const binding = normalAdoptions.rows.find(
    (row) =>
      row.actorAgentId === actorAgentId &&
      row.approved &&
      row.profileFingerprint === actualFingerprint &&
      contentHash === actualFingerprint &&
      row.goals.includes(goal) &&
      row.mindscape === 0 &&
      row.mode === 'standard_combat' &&
      row.modifiers.length === 0,
  )
  const sourceReview = originalReviews.records.find((row) => row.reviewId === binding?.reviewId)
  if (
    !binding ||
    !sourceReview ||
    !contract ||
    binding.externalId !== contract.externalId ||
    contract.source.repository !== 'https://github.com/frzyc/genshin-optimizer' ||
    contract.source.formulaPath !== binding.continuityCheck?.[1]?.path ||
    contract.source.statsPath !== binding.continuityCheck?.[0]?.path ||
    binding.sourceCommit !== contract.source.commit ||
    binding.formulaSha256 !== contract.source.formulaSha256 ||
    binding.statsSha256 !== contract.source.statsSha256
  )
    return undefined
  const review: Review = {
    ...sourceReview,
    reviewId: binding.adoptionId,
    gameVersion: binding.targetVersion,
    mode: 'standard_combat',
    sourceArtifactSha256: binding.reviewedSourceArtifactSha256,
    mindscapeRange: [0, 0],
    summary: `${sourceReview.summary} [普通 M0 储备用途政策；非账户影画事实；${sourceReview.gameVersion} 来源经独立连续性采用到 ${binding.targetVersion}。]`,
  }
  const context: Context = {
    profileId: binding.profileId,
    profileFingerprint: actualFingerprint,
    actorAgentId,
    externalId: contract.externalId,
    gameVersion: binding.targetVersion,
    mode: 'standard_combat',
    goal,
    mindscape: 0,
    sourceCommit: binding.sourceCommit,
    formulaSha256: binding.formulaSha256,
    statsSha256: binding.statsSha256,
    modifiers: [],
  }
  const adoption: Adoption = {
    reviewId: review.reviewId,
    profileId: binding.profileId,
    profileFingerprint: actualFingerprint,
    sourceCommit: binding.sourceCommit,
    formulaSha256: binding.formulaSha256,
    statsSha256: binding.statsSha256,
    buildKey: binding.buildKey,
    approved: binding.approved,
  }
  return { context, review, adoption }
}
export function resolveReviewedUseScope(
  fact: ExistingFact,
  context: Context,
  review: Review,
  adoption: Adoption | null,
): ScopedResult {
  const unchanged = (explanation: string): ScopedResult => ({
    ...fact,
    applied: false,
    useReviewId: null,
    explanation,
    evidenceUrls: [],
  })
  if (!adoption?.approved) return unchanged('该用途尚未与生产构筑显式绑定。')
  if (
    adoption.reviewId !== review.reviewId ||
    adoption.profileId !== context.profileId ||
    adoption.profileFingerprint !== context.profileFingerprint ||
    !context.profileFingerprint ||
    adoption.buildKey !== review.buildKey ||
    context.actorAgentId !== review.actorAgentId ||
    context.externalId !== review.externalId ||
    context.gameVersion !== review.gameVersion ||
    context.mode !== review.mode ||
    !review.goals.includes(context.goal) ||
    !Number.isInteger(context.mindscape) ||
    context.mindscape < review.mindscapeRange[0]! ||
    context.mindscape > review.mindscapeRange[1]! ||
    context.modifiers.length > 0 ||
    !/^[a-f\d]{40}$/i.test(context.sourceCommit) ||
    !/^[a-f\d]{64}$/i.test(context.formulaSha256) ||
    !/^[a-f\d]{64}$/i.test(context.statsSha256) ||
    adoption.sourceCommit !== context.sourceCommit ||
    adoption.formulaSha256.toLowerCase() !== context.formulaSha256.toLowerCase() ||
    adoption.statsSha256.toLowerCase() !== context.statsSha256.toLowerCase() ||
    !review.sources.length ||
    review.sources.some((s) => !s.url.startsWith('https://') || !s.locator)
  )
    return unchanged('角色、版本、构筑、影画或模式超出该条已审用途范围。')
  if (fact.mechanicalPresence === 'absent' || fact.utility === 'valid')
    return unchanged('保留既有明确机制证据或已成立用途。')
  if (fact.action === 'aftershock') {
    if (fact.mechanicalPresence === 'present')
      return unchanged('已有真实追加攻击证据，不被普通构筑范围排除。')
    if (
      fact.utility !== 'missing_fact' ||
      review.decision !== 'aftershock_not_adopted_for_this_build'
    )
      return unchanged('本条只处理由未决追加标签引起的用途缺口。')
    return {
      ...fact,
      utility: 'incidental',
      applied: true,
      predicateId: 'reviewed_normal_build_non_target',
      useReviewId: review.reviewId,
      explanation: review.summary + ' 本结论限定当前构筑，不证明内部标签不存在。',
      evidenceUrls: review.sources.map((s) => s.url),
    }
  }
  if (
    review.primaryAction === fact.action &&
    fact.mechanicalPresence === 'present' &&
    (fact.utility === 'incidental' ||
      fact.utility === 'conditional' ||
      fact.utility === 'missing_fact')
  ) {
    return {
      ...fact,
      utility: 'valid',
      applied: true,
      predicateId: 'reviewed_normal_build_primary_action',
      useReviewId: review.reviewId,
      explanation: review.summary,
      evidenceUrls: review.sources.map((s) => s.url),
    }
  }
  return unchanged('本条未裁决该动作的构筑价值。')
}
