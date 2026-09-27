import { getCurrentDriveDiscFormulaData } from '../gameDataPacks/currentDriveDiscFormulaCatalog'
import { stableContentHash } from '../gameDataPacks/types'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import {
  currentFormulaMechanicContractHash,
  getCurrentFormulaContractRequirements,
  resolveCurrentDriveDiscFourPieceContract,
} from './currentFormulaMechanicContracts'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectRuntime'
import type { SourceBackedEquipmentModifierBucket } from './currentPlanningTeamDpsRuntime'

export const currentDriveDiscPlanningEffectVersion = 'disc-fixed-event-passives-r1'

const directStats: Record<string, SourceBackedEquipmentModifierBucket['application']> = {
  'combat.crit_dmg_': 'crit_damage',
  'combat.crit_': 'crit_rate',
  'combat.dmg_': 'damage_bonus',
  'combat.common_dmg_': 'damage_bonus',
}
const actions: Record<string, string> = { basic: 'basic_attack', dash: 'dash', ult: 'ultimate' }

// Locked game descriptions: both triggers belong to any squad member and the
// same-name passive cannot stack. Keeping one wearer preserves this unknown
// effect; this does not assert uptime or grant its damage to every recipient.
// Swing Jazz is deliberately absent: its trigger belongs to the wearer.
export const sharedDiscProtectionSources = {
  'set-proto-punk': {
    formulaSha256: '8047673EA54F6D980D324EF42244F912E267BD881B4547C47FC364C9BB2BC36C',
    description: 'libs/zzz/dm-localization/assets/locales/en/disc_ProtoPunk_gen.json',
  },
  'set-astral-voice': {
    formulaSha256: 'A9635DECE4C2AD19F261D5A9BDB02189639AAED105B814ADDB131DAE5C2E5286',
    description: 'libs/zzz/dm-localization/assets/locales/en/disc_AstralVoice_gen.json',
  },
} as const

export function driveDiscEffectProtectionOwner(effect: {
  agentId: string
  setId: string
  reason: string
  sourceRefs: string[]
}) {
  const source =
    sharedDiscProtectionSources[effect.setId as keyof typeof sharedDiscProtectionSources]
  return source &&
    effect.reason === 'unobserved_condition' &&
    effect.sourceRefs.includes(source.formulaSha256)
    ? 'same-team-shared-trigger'
    : effect.agentId
}

/** Consume existing compiled source formulas, without inventing combat triggers. */
export function compileCurrentDriveDiscPlanningEffects(input: {
  members: readonly PlanningEffectRuntimeMember[]
  loadouts: readonly { agentId: string; discs: readonly { setId: string }[] }[]
}) {
  const buckets: SourceBackedEquipmentModifierBucket[] = []
  const exclusions: Array<{
    agentId: string
    setId: string
    reason: string
    fields: string[]
    sourceRefs: string[]
  }> = []
  const blockers: string[] = []
  for (const loadout of input.loadouts) {
    const member = input.members.find((item) => item.agentId === loadout.agentId)
    const identity = getCurrentAgentEventContract(loadout.agentId)?.identity
    if (!member || !identity) {
      blockers.push(`驱动盘效果缺少成员资料：${loadout.agentId}`)
      continue
    }
    const counts = new Map<string, number>()
    for (const disc of loadout.discs) counts.set(disc.setId, (counts.get(disc.setId) ?? 0) + 1)
    for (const [setId, count] of counts) {
      if (count < 4) continue
      const source = getCurrentDriveDiscFormulaData(setId)
      const requirements = getCurrentFormulaContractRequirements('drive_disc', setId)
      if (!source || !requirements) {
        blockers.push(`四件套缺少来源：${setId}`)
        continue
      }
      const sourceRefs = [
        source.fourPieceFormula.path,
        source.fourPieceFormula.sha256,
        currentFormulaMechanicContractHash,
      ]
      const exclude = (reason: string, fields: string[]) =>
        exclusions.push({ agentId: member.agentId, setId, reason, fields, sourceRefs })
      const flags: Record<string, boolean> = {}
      for (const flag of requirements.flags) {
        const match = /^eq:own.char.(attribute|specialty):(.+)$/.exec(flag)
        if (match) flags[flag] = identity[match[1] as 'attribute' | 'specialty'] === match[2]
      }
      // Polar combines its unconditional bonus and triggered multiplier in one
      // expression. Evaluate the declared no-trigger baseline, and retain the
      // excluded trigger explicitly. This is not an observed enemy state.
      if (source.upstreamKey === 'PolarMetal') {
        flags['PolarMetal:freeze_shatter'] = false
        exclude('unobserved_condition', ['PolarMetal:freeze_shatter'])
      }
      const result = resolveCurrentDriveDiscFourPieceContract({
        stableId: setId,
        equippedPieces: count,
        runtimePolicy: 'exclude_unobserved',
        runtime: {
          flags,
          numbers: {
            'own.initial.def': member.initialStats.def,
            'own.final.anomMas': member.finalStats.anomMas,
          },
        },
      })
      if (result.status !== 'supported') {
        blockers.push(...result.blockers)
        continue
      }
      if (result.source.sha256 !== source.fourPieceFormula.sha256) {
        blockers.push(`四件套公式版本需要重新核对：${setId}`)
        continue
      }
      for (const item of result.exclusions) exclude('unobserved_condition', item.reasons)
      if (!result.effects.length && !result.exclusions.length)
        exclude('static_condition_not_met', requirements.flags.concat(requirements.numbers))
      for (const [index, effect] of result.effects.entries()) {
        const stat = String(effect.stat)
        const attribute = /^combat.dmg_.(fire|electric|ice|ether|physical)$/.exec(stat)?.[1] ?? null
        const application = attribute ? 'damage_bonus' : directStats[stat]
        if (!application) {
          exclude('outside_direct_damage_domain', [stat])
          continue
        }
        if (
          effect.kind !== 'modifier' ||
          effect.target !== 'own' ||
          typeof effect.value !== 'number' ||
          !Number.isFinite(effect.value) ||
          (effect.action && !actions[String(effect.action)])
        ) {
          blockers.push(`四件套直接伤害效果尚未适配：${setId}:${stat}`)
          continue
        }
        buckets.push({
          bucketId: `disc:${member.agentId}:${setId}:${index}`,
          effectKey: `disc:${setId}:four-piece:${index}`,
          providerAgentId: member.agentId,
          recipientAgentIds: [member.agentId],
          receiverPath: null,
          damageType: null,
          action: effect.action ? actions[String(effect.action)]! : null,
          attribute,
          value: effect.value,
          application,
          sourceRefs,
        })
      }
      if (source.fourPieceFormula.todoMarkers.length)
        exclude('upstream_todo', source.fourPieceFormula.todoMarkers)
    }
  }
  const core = {
    version: currentDriveDiscPlanningEffectVersion,
    status: blockers.length ? ('unsupported' as const) : ('supported' as const),
    buckets,
    exclusions,
    blockers,
    boundary:
      '仅消费固定比较基线中可证明的四件套直接伤害效果；未观测触发、叠层、时窗及非直接伤害效果逐项排除。没有模拟全队四件套联动或证明18盘最优。',
  }
  return { ...core, fingerprint: stableContentHash(core) }
}
