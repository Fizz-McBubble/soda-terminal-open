import type { SourceBackedEquipmentModifierBucket } from './currentPlanningDamageModifiers'
import {
  currentWEngineStaticCatalog,
  getCurrentWEngineStaticData,
} from '../gameDataPacks/currentWEngineStaticCatalog'
import { reviewedWEngineReceiverSemantics32Identity } from './reviewedWEngineReceiverSemanticsIdentity32'
export { reviewedWEngineReceiverSemantics32Identity } from './reviewedWEngineReceiverSemanticsIdentity32'

const sourceRef = `upstream:${reviewedWEngineReceiverSemantics32Identity.sourceCommit}:${reviewedWEngineReceiverSemantics32Identity.sourcePath}`

function isMoonTeamDamage(bucket: SourceBackedEquipmentModifierBucket) {
  return (
    bucket.application === 'damage_bonus' &&
    (bucket.sourceFormula?.engineId === 'wengine-14162' ||
      // Recipient expansion changes positional P indices. The pinned sheet
      // contains one generic damage bonus, so identify every expansion of it.
      /^wengine:wengine-14162:(P:[0-9]+|source-effect:3)$/.test(bucket.effectKey)) &&
    bucket.action === null &&
    bucket.attribute === null
  )
}

/** Apply the sourced recipient rule after source effects have resolved for an event. */
export function applyReviewedWEngineReceiverSemantics32(
  input: readonly SourceBackedEquipmentModifierBucket[],
) {
  const sourceBound =
    reviewedWEngineReceiverSemantics32Identity.sourceVersions.includes(
      currentWEngineStaticCatalog.gameVersion,
    ) &&
    currentWEngineStaticCatalog.generatedFrom.commit ===
      reviewedWEngineReceiverSemantics32Identity.sourceCommit &&
    getCurrentWEngineStaticData('wengine-14162')?.source.formulaSha256.toLowerCase() ===
      reviewedWEngineReceiverSemantics32Identity.formulaSha256
  const activeProviders = new Set(
    input
      .filter((bucket) => isMoonTeamDamage(bucket) && bucket.value !== 0)
      .map((bucket) => bucket.providerAgentId),
  )
  const exclusions: Array<{
    effectKey: string
    reason: string
    fields: string[]
    sourceRefs: string[]
  }> = []
  const buckets = input.flatMap((bucket): SourceBackedEquipmentModifierBucket[] => {
    if (!isMoonTeamDamage(bucket)) return [bucket]
    if (!sourceBound) {
      exclusions.push({
        effectKey: bucket.effectKey,
        reason: '音擎来源身份已变，原目标规则修正不能自动沿用。',
        fields: ['reviewed_formula_identity'],
        sourceRefs: [...bucket.sourceRefs, sourceRef],
      })
      return []
    }
    if (activeProviders.size > 1) {
      exclusions.push({
        effectKey: bucket.effectKey,
        reason: '该音擎全队伤害增益只允许一个实例；缺少事件来源，无法选择生效提供者。',
        fields: ['unique_active_provider'],
        sourceRefs: [...bucket.sourceRefs, sourceRef],
      })
      return []
    }
    const recipients = bucket.recipientAgentIds.filter((id) => id !== bucket.providerAgentId)
    return recipients.length
      ? [
          {
            ...bucket,
            recipientAgentIds: [...new Set(recipients)],
            sourceRefs: [...new Set([...bucket.sourceRefs, sourceRef])],
          },
        ]
      : []
  })
  return { buckets, exclusions }
}
