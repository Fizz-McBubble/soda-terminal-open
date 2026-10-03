import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { resolveCurrentDriveDiscFourPieceContract } from './currentFormulaMechanicContracts'
import type {
  PlanningEffectRuntimeMember,
  PlanningEffectRuntimeStats,
} from './currentPlanningEffectDomain'
import type {
  SourceBackedEquipmentModifierBucket,
  SourceBackedPlanningEffectBucket,
} from './currentPlanningDamageModifiers'
import {
  bindDeclaredDriveDiscRuntime32,
  getReviewedDriveDiscSource32,
  type DriveDiscEventRuntimeBinding32,
} from './reviewedDriveDiscConditionDomains32'
import { reviewedDriveDiscSemanticsIdentity32 as identity } from './reviewedDriveDiscSemanticsIdentity32'

const applications = {
  'combat.common_dmg_': 'damage_bonus',
  'combat.crit_': 'crit_rate',
  'combat.crit_dmg_': 'crit_damage',
} as const
const unsupported = (...blockers: string[]) => ({ status: 'unsupported' as const, blockers })

/** Source-backed event states are operands, not claims of simulated uptime. */
export function compileReviewedDriveDiscEventEffects32(input: {
  members: readonly PlanningEffectRuntimeMember[]
  loadouts: readonly { agentId: string; discs: readonly { setId: string }[] }[]
  ownerAgentId: string
  runtimeBindings: readonly DriveDiscEventRuntimeBinding32[]
}) {
  const buckets: SourceBackedEquipmentModifierBucket[] = []
  for (const loadout of input.loadouts) {
    const member = input.members.find((row) => row.agentId === loadout.agentId)
    if (!member) return unsupported('四件套事件缺少真实穿戴者。')
    const counts = new Map<string, number>()
    for (const disc of loadout.discs) counts.set(disc.setId, (counts.get(disc.setId) ?? 0) + 1)
    for (const [setId, count] of counts) {
      if (count < 4 || !(setId in identity.sources)) continue
      const source = getReviewedDriveDiscSource32(setId)
      if (!source) return unsupported(`四件套锁定公式已变化：${setId}`)
      const runtime = bindDeclaredDriveDiscRuntime32(input.runtimeBindings, member.agentId, setId)
      const specialty = getCurrentAgentEventContract(member.agentId)?.identity.specialty
      // Thorned Rose has no combat trigger. Other reviewed sets require all
      // applicable public declarations, including explicit false / zero.
      if (!runtime && setId !== 'set-34200') return unsupported(`四件套事件状态尚未声明：${setId}`)
      const bound = {
        ...runtime,
        flags: {
          ...runtime?.flags,
          'eq:own.char.specialty:stun': specialty === 'stun',
          'eq:own.char.specialty:support': specialty === 'support',
        },
        numbers: {
          ...runtime?.numbers,
          'own.initial.def': member.initialStats.def,
          // A preview is retained as a deferred node even when it is zero;
          // only event-final evaluation can grant King's combat crit damage.
          'own.final.crit_': member.finalStats.crit_,
        },
      }
      if (setId === 'set-astral-voice') {
        const eligible = runtime?.flags?.['AstralVoice:eligible_event_owner']
        if (typeof eligible !== 'boolean')
          return unsupported('静听嘉音缺少当前伤害角色的快速支援受益状态。')
        const stack = runtime?.accumulators?.['AstralVoice:astral']
        if (!Number.isInteger(stack) || stack! < 0 || stack! > 3)
          return unsupported('静听嘉音层数必须为0至3的整数。')
      }
      const result = resolveCurrentDriveDiscFourPieceContract({
        stableId: setId,
        equippedPieces: count,
        runtimePolicy: 'strict',
        runtime: bound,
      })
      if (result.status !== 'supported') return result
      const sourceRefs = [
        `${source.source.fourPieceFormula.path}#sha256=${source.pin.sha256}`,
        `libs/zzz/dm-localization/assets/locales/en/disc_${source.pin.key}_gen.json#sha256=${source.pin.localizationSha256}`,
        identity.revision,
      ]
      const recipients =
        setId === 'set-34200'
          ? [member.agentId]
          : setId === 'set-astral-voice'
            ? runtime!.flags!['AstralVoice:eligible_event_owner']
              ? [input.ownerAgentId]
              : []
            : input.members.map((row) => row.agentId)
      const effects: readonly Record<string, unknown>[] =
        setId === 'set-king-of-the-summit'
          ? [{ kind: 'modifier', target: 'team', stat: 'combat.crit_dmg_', value: 0 }]
          : result.effects
      for (const [index, effect] of effects.entries()) {
        const application = applications[effect.stat as keyof typeof applications]
        if (
          !application ||
          effect.kind !== 'modifier' ||
          typeof effect.value !== 'number' ||
          !Number.isFinite(effect.value) ||
          effect.action
        )
          return unsupported(`四件套效果超出已审直接事件域：${setId}`)
        buckets.push({
          bucketId: `disc:${member.agentId}:${setId}:${index}`,
          effectKey: `disc:${setId}:four-piece:${index}`,
          providerAgentId: member.agentId,
          recipientAgentIds: recipients,
          receiverPath: null,
          damageType: null,
          action: null,
          attribute: null,
          value: effect.value,
          application,
          sourceRefs,
          ...(setId === 'set-king-of-the-summit'
            ? {
                sourceDiscFormula: {
                  setId,
                  equippedPieces: count,
                  formulaSha256: source.pin.sha256,
                  runtime: bound,
                },
              }
            : {}),
        })
      }
    }
  }
  return { status: 'supported' as const, buckets }
}

/** Recheck node source identity before binding its sole final-stat dependency. */
export function evaluateReviewedDriveDiscFinalNode32(
  bucket: SourceBackedPlanningEffectBucket,
  stats: Readonly<Record<string, PlanningEffectRuntimeStats>>,
) {
  const node = bucket.sourceDiscFormula
  const source = node && getReviewedDriveDiscSource32(node.setId)
  if (
    !node ||
    node.setId !== 'set-king-of-the-summit' ||
    !source ||
    source.pin.sha256 !== node.formulaSha256 ||
    bucket.application !== 'crit_damage' ||
    !bucket.sourceRefs.some((ref) => ref.endsWith(node.formulaSha256))
  )
    return unsupported('四件套最终属性节点与锁定公式不一致。')
  const result = resolveCurrentDriveDiscFourPieceContract({
    stableId: node.setId,
    equippedPieces: node.equippedPieces,
    runtimePolicy: 'strict',
    runtime: {
      ...node.runtime,
      numbers: { ...node.runtime.numbers, 'own.final.crit_': stats[bucket.providerAgentId]?.crit_ },
    },
  })
  if (result.status !== 'supported') return result
  const value = result.effects[0]?.value ?? 0
  return typeof value !== 'number' || !Number.isFinite(value)
    ? unsupported('四件套最终属性节点产生无效数值。')
    : { status: 'supported' as const, buckets: [{ ...bucket, value }] }
}

/** The description forbids stacking but does not establish max/last precedence. */
export function deduplicateReviewedDriveDiscEffects32(
  buckets: readonly SourceBackedPlanningEffectBucket[],
) {
  const output: SourceBackedPlanningEffectBucket[] = []
  const seen = new Map<string, SourceBackedPlanningEffectBucket>()
  for (const bucket of buckets) {
    if (
      !bucket.effectKey.startsWith('disc:') ||
      !bucket.effectKey.includes(':four-piece:') ||
      bucket.effectKey.startsWith('disc:set-34200:') ||
      bucket.value === 0
    ) {
      output.push(bucket)
      continue
    }
    for (const recipient of bucket.recipientAgentIds) {
      const key = `${bucket.effectKey}:${recipient}:${bucket.application}`
      const prior = seen.get(key)
      if (prior && prior.value !== bucket.value)
        return unsupported(`同名四件套有不同活跃值，替换先后尚未声明：${bucket.effectKey}`)
      if (prior) continue
      const one = { ...bucket, recipientAgentIds: [recipient] }
      seen.set(key, one)
      output.push(one)
    }
  }
  return { status: 'supported' as const, buckets: output }
}
