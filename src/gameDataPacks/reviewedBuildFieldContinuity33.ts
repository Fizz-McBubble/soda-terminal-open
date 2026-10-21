import targetReview from './data/reviewed-contextual-target-panel-continuity.3.3.json'
import review from './data/reviewed-build-field-continuity.3.3.json'
import { stableContentHash } from './types'
import type { AgentProfileField } from './agentProfile'
import { reviewedVersionApplicability33 } from './reviewedVersionApplicability33'

const entries = new Map(review.entries.map((row) => [`${row.agentId}:${row.fieldId}`, row]))
const formulas = new Map(review.formulaBindings.map((row) => [row.agentId, row.formulaSha256]))
export const reviewedBuildFieldContinuity33 = Object.freeze({
  id: review.id,
  targetVersion: review.targetVersion,
  scope: review.scope,
  sourceDeltaHash: review.sourceDeltaHash,
  contentHash: stableContentHash(review),
  fieldCount: review.entries.length,
  actorCount: review.formulaBindings.length,
  ...review.boundary,
})
/** Exact historical payload/source/formula retention, never a current meta or runtime proof. */
export function resolveReviewedBuildFieldContinuity33(input: {
  agentId: string
  targetVersion: string
  field?: AgentProfileField
  formulaSha256?: string
  scope?: string
}) {
  const field = input.field
  const entry = field && entries.get(`${input.agentId}:${field.path}`)
  if (
    input.targetVersion !== '3.3' ||
    (input.scope ?? 'formed_generic_guidance_reference') !== review.scope ||
    review.sourceDeltaHash !== reviewedVersionApplicability33.sourceDeltaHash ||
    review.sourceDeltaHash !== 'DD6B87A5CBFBB965726D2C79297F630EBCA85187AF09F7802A6F4D0D5B3A0AE0' ||
    !entry ||
    !field ||
    field.status === 'missing' ||
    field.conflict ||
    field.currentApplicability !== 'continuous' ||
    entry.sourceReviewVersion !== field.gameVersion ||
    entry.valueHash !== stableContentHash(field.value) ||
    entry.sourceRefsHash !== stableContentHash(field.sourceRefs) ||
    entry.conditionsHash !== stableContentHash(field.conditions ?? []) ||
    !input.formulaSha256 ||
    formulas.get(input.agentId)?.toLowerCase() !== input.formulaSha256.toLowerCase()
  )
    return null
  return {
    adoptionId: review.id,
    sourceReviewVersion: field.gameVersion,
    adoptedForVersion: '3.3',
    referenceContentHash: stableContentHash({ entry, formulaSha256: input.formulaSha256 }),
    sourceIdentity: reviewedBuildFieldContinuity33,
    boundary:
      field.path === 'build.team_bangboo_scenario'
        ? '仅沿用原成员、条件与培养方向；队伍档位独立核验，不证明3.3强度或运行时效果。'
        : '仅沿用已成形的一般培养参考；原来源版本保留，不证明3.3 meta、运行时、Formal、Import或精确DPS。',
  }
}

/** Two exact traditional teams; old author/local reviews remain historical. */
export function resolveReviewedContextualTargetPanelContinuity33(input: {
  targetVersion: string
  memberIds: readonly string[]
  value: unknown
  sourceRefs: readonly unknown[]
  conditions: readonly string[]
  formulaBindings: readonly { agentId: string; formulaSha256: string }[]
  scope?: string
}) {
  if (
    input.targetVersion !== '3.3' ||
    (input.scope ?? targetReview.scope) !== 'generic_target_panel_reference33' ||
    targetReview.sourceDeltaHash !== reviewedVersionApplicability33.sourceDeltaHash
  )
    return null
  const key = [...input.memberIds].sort().join('|')
  const entry = targetReview.entries.find((row) => row.memberIds.join('|') === key)
  if (
    !entry ||
    entry.valueHash !== stableContentHash(input.value) ||
    entry.sourceRefsHash !== stableContentHash(input.sourceRefs) ||
    entry.conditionsHash !== stableContentHash(input.conditions) ||
    input.formulaBindings.length !== 3 ||
    new Set(input.formulaBindings.map((row) => row.agentId)).size !== 3 ||
    entry.formulaBindings.some(
      (binding) =>
        !input.formulaBindings.some(
          (actual) =>
            actual.agentId === binding.agentId &&
            actual.formulaSha256.toLowerCase() === binding.formulaSha256.toLowerCase(),
        ),
    )
  )
    return null
  return {
    scope: 'generic_target_panel_reference33' as const,
    targetVersion: '3.3',
    evaluatedForVersion: '3.3',
    sourceReviewVersion: '3.2',
    referenceContentHash: stableContentHash(entry),
    sourceDeltaHash: targetReview.sourceDeltaHash,
    runtimePromotion: false,
    formalPromotion: false,
    importPromotion: false,
    boundary: '仅保留具名传统队目标面板培养参考；原作者及本地3.2复核保留，不证明官方运行时修复。',
  }
}
