import type { CandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import type { StatKey } from '../domain/schemas'
import type {
  RetentionUtilityEvidence,
  RetentionUtilityState,
} from './absoluteDiscRetentionUseFacts'
export const EFFECT_TO_DOMAIN_STAT: Record<string, StatKey> = {
  atk_: 'atk_percent',
  hp_: 'hp_percent',
  def_: 'def_percent',
  crit_: 'crit_rate',
  crit_dmg_: 'crit_dmg',
  anomProf: 'anomaly_proficiency',
  anomMas_: 'anomaly_mastery',
  impact_: 'impact',
  enerRegen_: 'energy_regen',
  pen_: 'pen_ratio',
  physical_dmg_: 'physical_dmg',
  fire_dmg_: 'fire_dmg',
  ice_dmg_: 'ice_dmg',
  electric_dmg_: 'electric_dmg',
  ether_dmg_: 'ether_dmg',
  wind_dmg_: 'wind_dmg',
}

export const ELEMENT_EFFECT_MAP: Record<string, string> = {
  physical: 'physical_dmg_',
  fire: 'fire_dmg_',
  ice: 'ice_dmg_',
  electric: 'electric_dmg_',
  ether: 'ether_dmg_',
  wind: 'wind_dmg_',
  frost: 'ice_dmg_',
}

export function resolveEffectUtility(
  effectStat: string,
  agentId: string,
  constraint: CandidateWarehouseConstraint,
  goal: 'crit_damage' | 'anomaly_damage' | 'functional' | 'unknown',
  agentAttr: string,
  evidenceIds: string[],
  context: {
    hasShield: boolean
    hpScaling: boolean
    defScaling: boolean
    sheerDefenseBypass: boolean
    isJane: boolean
    role?: string | null
  },
): RetentionUtilityEvidence {
  const ev = (
    state: RetentionUtilityState,
    predicateId: string,
    detail: string,
  ): RetentionUtilityEvidence => ({
    state,
    predicateId,
    evidenceIds,
    detail,
  })

  if (constraint.status === 'missing' || constraint.sources.length === 0) {
    return ev(
      'missing_fact',
      'missing_build_source',
      `Verified build source facts missing for ${agentId}.`,
    )
  }

  const allMains = new Set(Object.values(constraint.mainStats).flat())
  const weights = constraint.subStatWeights
  const mappedDomainStat = EFFECT_TO_DOMAIN_STAT[effectStat]
  const isRecommended =
    mappedDomainStat && ((weights[mappedDomainStat] ?? 0) > 0 || allMains.has(mappedDomainStat))

  // 1. Elemental damage bonuses
  if (Object.values(ELEMENT_EFFECT_MAP).includes(effectStat)) {
    const matchingEffect = ELEMENT_EFFECT_MAP[agentAttr]
    if (effectStat === matchingEffect) {
      const isSpecial = agentAttr === 'frost'
      return ev(
        'valid',
        isSpecial ? 'sourced_special_attribute_channel' : 'matching_elemental_damage_channel',
        isSpecial
          ? `Adopted source maps special attribute ${agentAttr} to ${effectStat}.`
          : `Agent attribute is ${agentAttr}; ${effectStat} amplifies matching damage channel.`,
      )
    }
    return ev(
      'incompatible',
      'non_matching_element_damage_channel',
      `Agent attribute is ${agentAttr}; ${effectStat} damage channel is incompatible.`,
    )
  }

  // 2. Shield effect
  if (effectStat === 'shield_') {
    return context.hasShield
      ? ev(
          'valid',
          'active_shield_mechanic_in_kit',
          'Agent kit possesses active shield mechanics; shield_ increases absorption.',
        )
      : ev(
          'incompatible',
          'no_shield_mechanic_in_kit',
          'Agent kit has no shield mechanics; defense specialty alone is not shield proof.',
        )
  }

  // 3. Daze increase (King of the Summit)
  if (effectStat === 'dazeInc_') {
    return context.role === 'stun' || allMains.has('impact')
      ? ev(
          'valid',
          'daze_buildup_primary_utility',
          'Agent role or build focuses on daze buildup; dazeInc_ accelerates stun windows.',
        )
      : ev(
          'incidental',
          'generic_combat_daze_benefit',
          'Agent attacks inflict daze, but daze increase is incidental to primary goal.',
        )
  }

  // 4. Impact (Shockstar Disco)
  if (effectStat === 'impact_') {
    return context.role === 'stun' || allMains.has('impact')
      ? ev(
          'valid',
          'impact_scaling_primary_target',
          'Impact is a primary build target scaling daze application.',
        )
      : ev(
          'incidental',
          'generic_impact_benefit',
          'Impact increases hit daze, but is incidental to non-stun role.',
        )
  }

  // 5. Penetration ratio (Puffer Electro)
  if (effectStat === 'pen_') {
    if (context.sheerDefenseBypass) {
      return ev(
        'incompatible',
        'sheer_bypasses_defense',
        'Sheer damage bypasses 100% of enemy defense; defense penetration ratio provides zero benefit.',
      )
    }
    if (isRecommended) {
      return ev(
        'valid',
        'penetration_ratio_primary_target',
        'Penetration ratio is a primary recommended build stat ignoring enemy defense.',
      )
    }
    return ev(
      'incidental',
      'generic_defense_penetration_benefit',
      'Penetration ratio reduces enemy defense, but is not the targeted build stat.',
    )
  }

  // 6. Critical rate & Critical damage
  if (effectStat === 'crit_' || effectStat === 'crit_dmg_') {
    if (context.isJane && goal === 'anomaly_damage') {
      return ev(
        'incidental',
        'special_anomaly_crit_uses_proficiency',
        '简的强击暴击率读取异常精通，暴伤读取核心技；普通暴击/暴伤词条只服务直伤，不是该异常构筑的储备目标。',
      )
    }
    if (goal === 'crit_damage' && isRecommended) {
      return ev(
        'valid',
        'crit_damage_primary_target',
        'Agent build targets critical strike output for direct damage amplification.',
      )
    }
    if (goal === 'anomaly_damage') {
      return ev(
        'incidental',
        'non_crit_anomaly_channel',
        'Standard anomaly damage cannot critically strike; crit stats benefit only incidental direct hits.',
      )
    }
    return isRecommended
      ? ev('valid', 'crit_damage_primary_target', 'Agent build targets critical strike output.')
      : ev(
          'incidental',
          'secondary_crit_benefit',
          'Critical strike occurs on attacks, but is incidental to primary functional goal.',
        )
  }

  // 7. HP %
  if (effectStat === 'hp_') {
    return context.hpScaling
      ? ev(
          'valid',
          'hp_scaling_mechanical_input',
          'Agent mechanics scale directly with maximum HP for damage or sheer force.',
        )
      : ev(
          'incidental',
          'generic_survivability_benefit',
          'HP increases survivability, but does not scale kit damage output.',
        )
  }

  // 8. DEF %
  if (effectStat === 'def_') {
    return context.defScaling
      ? ev(
          'valid',
          'def_scaling_mechanical_input',
          'Agent mechanics scale directly with DEF for damage and shield capacity.',
        )
      : ev(
          'incidental',
          'generic_defense_survivability_benefit',
          'DEF reduces incoming damage, but does not scale primary build output.',
        )
  }

  // 9. Anomaly Proficiency
  if (effectStat === 'anomProf') {
    return goal === 'anomaly_damage' || isRecommended
      ? ev(
          'valid',
          'anomaly_proficiency_primary_target',
          'Anomaly proficiency is a primary build target scaling attribute anomaly damage.',
        )
      : ev(
          'incidental',
          'generic_anomaly_damage_benefit',
          'Agent can trigger anomalies, but proficiency is incidental to direct damage build.',
        )
  }

  // 10. Anomaly Mastery
  if (effectStat === 'anomMas_') {
    return goal === 'anomaly_damage' || allMains.has('anomaly_mastery') || isRecommended
      ? ev(
          'valid',
          'anomaly_mastery_primary_target',
          'Anomaly mastery accelerates anomaly buildup for the build.',
        )
      : ev(
          'incidental',
          'generic_anomaly_buildup_benefit',
          'Anomaly mastery accelerates buildup, but is incidental to direct damage build.',
        )
  }

  // 11. Energy Regen
  if (effectStat === 'enerRegen_') {
    return context.role === 'support' || allMains.has('energy_regen') || isRecommended
      ? ev(
          'valid',
          'energy_regeneration_primary_target',
          'Energy regeneration is a primary build target supporting skill uptime.',
        )
      : ev(
          'incidental',
          'generic_energy_rotation_benefit',
          'Energy regeneration improves EX special availability, but is incidental to build.',
        )
  }

  // 12. Attack %
  if (effectStat === 'atk_') {
    return isRecommended || (!context.hpScaling && !context.defScaling && goal !== 'functional')
      ? ev(
          'valid',
          'attack_scaling_primary_target',
          'Attack is the core mechanical scaling stat for abilities and damage output.',
        )
      : ev(
          'incidental',
          'secondary_attack_benefit',
          'Attack contributes to base formulas, but build scales primarily with other stats.',
        )
  }

  return isRecommended
    ? ev(
        'valid',
        'build_primary_stat_target',
        'Stat evaluated as recommended in source build directions.',
      )
    : ev(
        'incidental',
        'non_reserve_target_benefit',
        'Stat is incidental to non-reserve build targets.',
      )
}
