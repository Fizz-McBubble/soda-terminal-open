import type { PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'
import type { PreparedAnomalyExclusion32 } from './reviewedPreparedAnomalyEquipment32'
import {
  ariaLocalizationSourceSha256,
  type PreparedAnomalyPreparation32,
} from './reviewedPreparedAnomalyDeclarations32'

export function applyReviewedPreparedAriaMindscapes32(input: {
  member: PlanningEffectRuntimeMember
  preparation: PreparedAnomalyPreparation32
  sums: Record<string, number>
  included: string[]
  refs: string[]
  exclusions: PreparedAnomalyExclusion32[]
}) {
  const { member, preparation, sums, included, refs, exclusions } = input
  if (preparation.kind === 'aria_single_self_ether_abloom') {
    if (member.mindscape >= 1) {
      const excessMas = Math.max(0, member.initialStats.anomMas - 100)
      const m1CritRate = 0.25 + excessMas * 0.005
      const m1CritDmg = 0.25
      sums['combat.anom_crit_'] = (sums['combat.anom_crit_'] ?? 0) + m1CritRate
      sums['combat.anom_crit_dmg_'] = (sums['combat.anom_crit_dmg_'] ?? 0) + m1CritDmg
      included.push('agent-aria:m1_energetic_sound_waves')
      refs.push(
        `libs/zzz/dm-localization/assets/locales/en/char_Aria_gen.json#sha256=${ariaLocalizationSourceSha256}#/mindscapes/1`,
      )
      exclusions.push({
        effectKey: 'agent-aria:m1_buildup_res_ignore',
        reason: 'outside_anomaly_settlement_scope',
        fields: ['anomBuildupRes_'],
        sourceRefs: [
          `libs/zzz/dm-localization/assets/locales/en/char_Aria_gen.json#sha256=${ariaLocalizationSourceSha256}#/mindscapes/1`,
        ],
      })
    }
    if (member.mindscape >= 2) {
      const m2DefIgn = 0.16 + (preparation.momentOfDelusion ? 0.08 : 0)
      sums['combat.defIgn_'] = (sums['combat.defIgn_'] ?? 0) + m2DefIgn
      included.push('agent-aria:m2_fantastical_beat')
      refs.push(
        `libs/zzz/dm-localization/assets/locales/en/char_Aria_gen.json#sha256=${ariaLocalizationSourceSha256}#/mindscapes/2`,
      )
    }
    if (member.mindscape >= 3) {
      exclusions.push({
        effectKey: 'agent-aria:m3_delulu',
        reason: 'outside_anomaly_settlement_scope',
        fields: ['skillLevels'],
        sourceRefs: [
          `libs/zzz/dm-localization/assets/locales/en/char_Aria_gen.json#sha256=${ariaLocalizationSourceSha256}#/mindscapes/3`,
        ],
      })
    }
    if (member.mindscape >= 4) {
      exclusions.push({
        effectKey: 'agent-aria:m4_mechanical_angel',
        reason: 'outside_anomaly_settlement_scope',
        fields: ['energy', 'decibels', 'rotation'],
        sourceRefs: [
          `libs/zzz/dm-localization/assets/locales/en/char_Aria_gen.json#sha256=${ariaLocalizationSourceSha256}#/mindscapes/4`,
        ],
      })
    }
    if (member.mindscape >= 5) {
      exclusions.push({
        effectKey: 'agent-aria:m5_tears_in_the_rain',
        reason: 'outside_anomaly_settlement_scope',
        fields: ['skillLevels'],
        sourceRefs: [
          `libs/zzz/dm-localization/assets/locales/en/char_Aria_gen.json#sha256=${ariaLocalizationSourceSha256}#/mindscapes/5`,
        ],
      })
    }
    if (member.mindscape >= 6) {
      exclusions.push({
        effectKey: 'agent-aria:m6_constructs_dream',
        reason: 'outside_anomaly_settlement_scope',
        fields: ['decibels', 'actionDamageBonus', 'allOutCheering', 'rotation'],
        sourceRefs: [
          `libs/zzz/dm-localization/assets/locales/en/char_Aria_gen.json#sha256=${ariaLocalizationSourceSha256}#/mindscapes/6`,
        ],
      })
    }
  }
}
