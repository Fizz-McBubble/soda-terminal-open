import type { SourceBackedEquipmentModifierBucket } from './currentPlanningDamageModifiers'
import {
  currentWEngineStaticCatalog,
  getCurrentWEngineStaticData,
} from '../gameDataPacks/currentWEngineStaticCatalog'
import { functionalEffectMetadata32 } from './reviewedFunctionalEquipmentDependencies32'

export const reviewedSpringEmbraceReceiverIdentity32 = Object.freeze({
  revision: 'spring-embrace-current-recipient-r1',
  sourceCommit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  formulaSha256: '41fb78a01a42f4d9d86a0138b11389a868fa3bb5fbc2203cbc58719210ce2b18',
  descriptionSha256: '0eac30b78318540a2d8a11f19b4fd86d8d67cd458c5754f2f8cb166ce9f93d61',
  sourcePath: 'libs/zzz/dm-localization/assets/locales/en/wengine_SpringEmbrace_gen.json',
  rule: 'one_current_recipient; transfer_on_holder_switch; refresh_12_seconds; same_name_does_not_stack',
})
const identity = reviewedSpringEmbraceReceiverIdentity32
const sourceRef = `upstream:${identity.sourceCommit}:${identity.sourcePath}#${identity.descriptionSha256}`
function spring(bucket: SourceBackedEquipmentModifierBucket) {
  return (
    bucket.application === 'energy_regen_percent' &&
    (bucket.sourceReceiverObservation?.engineId === 'wengine-13011' ||
      /^wengine:wengine-13011:/.test(bucket.effectKey))
  )
}

/** A declared current passive holder binds the recipient, not an invented switch timeline. */
export function applyReviewedSpringEmbraceReceivers32(
  input: readonly SourceBackedEquipmentModifierBucket[],
) {
  const active = input.filter((bucket) => spring(bucket) && bucket.value !== 0)
  const providers = new Set(active.map((bucket) => bucket.providerAgentId))
  const winners = new Set(
    active.map((bucket) => bucket.sourceReceiverObservation?.activeProviderAgentId),
  )
  const winner =
    providers.size <= 1
      ? active.some(
          (bucket) =>
            bucket.sourceReceiverObservation?.activeProviderAgentId !== undefined &&
            bucket.sourceReceiverObservation.activeProviderAgentId !== bucket.providerAgentId,
        )
        ? null
        : [...providers][0]
      : winners.size === 1 && !winners.has(undefined) && providers.has([...winners][0]!)
        ? [...winners][0]
        : null
  const sourceBound =
    ['3.2', '3.2-phase-ii'].includes(currentWEngineStaticCatalog.gameVersion) &&
    currentWEngineStaticCatalog.generatedFrom.commit === identity.sourceCommit &&
    getCurrentWEngineStaticData('wengine-13011')?.source.formulaSha256.toLowerCase() ===
      identity.formulaSha256
  const exclusions: Array<
    { effectKey: string; reason: string; fields: string[]; sourceRefs: string[] } & ReturnType<
      typeof functionalEffectMetadata32
    >
  > = []
  const buckets = input.flatMap((bucket): SourceBackedEquipmentModifierBucket[] => {
    if (!spring(bucket) || bucket.value === 0) return [bucket]
    if (sourceBound && winner && bucket.providerAgentId !== winner) return []
    const observed = bucket.sourceReceiverObservation
    const sameProviderRecipients = new Set(
      active
        .filter((row) => row.providerAgentId === bucket.providerAgentId)
        .map((row) => row.sourceReceiverObservation?.recipientAgentId),
    )
    const field = !sourceBound
      ? 'reviewed_formula_identity'
      : !winner
        ? 'unique_active_provider'
        : !observed?.memberIds.includes(observed.recipientAgentId ?? '') ||
            sameProviderRecipients.size !== 1
          ? 'SpringEmbrace:recipientAgentId'
          : null
    if (field) {
      exclusions.push({
        effectKey: bucket.effectKey,
        reason: '转交回能增益缺少一致的当前受益者或生效实例，不能扩展到全队。',
        fields: [field],
        sourceRefs: [...bucket.sourceRefs, sourceRef],
        ...functionalEffectMetadata32(
          'team.combat.enerRegen_',
          bucket.providerAgentId,
          observed?.memberIds ?? bucket.recipientAgentIds,
        ),
      })
      return []
    }
    if (
      bucket.providerAgentId !== winner ||
      !bucket.recipientAgentIds.includes(observed!.recipientAgentId!)
    )
      return []
    return [
      {
        ...bucket,
        recipientAgentIds: [observed!.recipientAgentId!],
        sourceRefs: [...new Set([...bucket.sourceRefs, sourceRef])],
      },
    ]
  })
  return { buckets, exclusions }
}
