/** Sourced modifier domains, recipient binding and event scope matching; no damage calculation. */
export type SourceBackedPlanningEffectBucket = {
  bucketId: string
  effectKey: string
  effectId?: string
  applicationScope?: 'generic' | 'event_only'
  providerAgentId: string
  recipientAgentIds: string[]
  receiverPath: string | null
  damageType: string | null
  action: string | null
  attribute: string | null
  value: number
  application:
    | 'attack_percent'
    | 'attack_flat'
    | 'defense_percent'
    | 'defense_flat'
    | 'hp_percent'
    | 'hp_flat'
    | 'laceration_damage'
    | 'sharp_damage_bonus'
    | 'sheer_force'
    | 'sheer_damage_bonus'
    | 'direct_damage_bonus'
    | 'buff_bonus'
    | 'vulnerability'
    | 'stun_damage_bonus'
    | 'motion_value_multiplier'
    | 'crit_rate'
    | 'crit_damage'
    | 'damage_bonus'
    | 'defense_reduction'
    | 'defense_ignore'
    | 'resistance_reduction'
    | 'resistance_ignore'
    | 'penetration_ratio'
    | 'outside_direct_event_formula'
  sourceRefs: string[]
  /** Locked four-piece node evaluated against the provider's event-final panel. */
  sourceDiscFormula?: {
    setId: string
    equippedPieces: number
    formulaSha256: string
    runtime: {
      flags?: Readonly<Record<string, boolean>>
      numbers?: Readonly<Record<string, number>>
      accumulators?: Readonly<Record<string, number>>
    }
  }
  /** Source expression retained for event-final-stat dependency evaluation, including zero previews. */
  sourceFormula?: {
    engineId: string
    refinement: number
    effectIndex: number
    finalStatReferences: string[]
    runtime?: {
      flags?: Readonly<Record<string, boolean>>
      numbers?: Readonly<Record<string, number>>
      accumulators?: Readonly<Record<string, number>>
    }
  }
}

export type SourceBackedEquipmentModifierBucket = Omit<
  SourceBackedPlanningEffectBucket,
  'effectKey' | 'receiverPath' | 'damageType'
> & {
  effectKey: string
  receiverPath: null
  damageType: null
}

type DirectDamageModifiers = {
  attackPercent: number
  attackFlat: number
  defensePercent: number
  defenseFlat: number
  hpPercent: number
  hpFlat: number
  lacerationDamage: number
  sharpDamageBonus: number
  sheerForce: number
  sheerDamageBonus: number
  directDamageBonus: number
  buffBonus: number
  vulnerability: number
  stunDamageBonus: number
  motionValueMultiplier: number
  critRate: number
  critDamage: number
  damageBonus: number
  defenseReduction: number
  defenseIgnore: number
  resistanceReduction: number
  resistanceIgnore: number
  penetrationRatio: number
}

/** Catalog adapter accepts only reviewed family/scaling pairs, never specialty guesses. */
export function getPlanningDamageEventSemantics(event: {
  formulaFamily?: string
  scalingAttribute?: string
  formulaProjection?: string
}) {
  if (event.formulaProjection === 'raw_only') return null
  if (event.formulaFamily === undefined && event.scalingAttribute === undefined)
    return {
      family: 'direct' as const,
      scalingAttribute: 'attack' as const,
      authority: 'legacy_attack_only_catalog' as const,
    }
  if (event.formulaFamily === 'standard_direct_damage' && event.scalingAttribute === 'atk')
    return {
      family: 'direct' as const,
      scalingAttribute: 'attack' as const,
      authority: 'typed_catalog' as const,
    }
  if (event.formulaFamily === 'standard_direct_damage' && event.scalingAttribute === 'def')
    return {
      family: 'direct' as const,
      scalingAttribute: 'defense' as const,
      authority: 'typed_catalog' as const,
    }
  if (event.formulaFamily === 'sharp_damage' && event.scalingAttribute === 'def')
    return {
      family: 'sharp' as const,
      scalingAttribute: 'defense' as const,
      authority: 'typed_catalog' as const,
    }
  if (event.formulaFamily === 'sheer_damage' && event.scalingAttribute === 'sheerForce')
    return {
      family: 'sheer' as const,
      scalingAttribute: 'sheerForce' as const,
      authority: 'typed_catalog' as const,
    }
  return null
}

export function recipientIds(input: {
  targetKinds: readonly string[]
  providerAgentId: string
  memberIds: readonly string[]
  receiverPath?: string | null
}) {
  if (input.receiverPath?.startsWith('notOwnBuff.'))
    return input.memberIds.filter((id) => id !== input.providerAgentId)
  if (input.targetKinds.includes('self')) return [input.providerAgentId]
  if (input.targetKinds.includes('active_agent')) return [input.memberIds[0]]
  // Enemy debuffs and team buffs are both applied against each member's own
  // fixed event damage. This records the shared source once per recipient,
  // rather than inventing an owner-damage bucket.
  return [...input.memberIds]
}

export function applicationForReceiver(receiverPath: string | null) {
  if (!receiverPath) return 'outside_direct_event_formula' as const
  if (receiverPath === 'enemyDebuff.common.stun_') return 'stun_damage_bonus' as const
  if (receiverPath.includes('.initial.')) return 'outside_direct_event_formula' as const
  if (/(ownBuff|notOwnBuff|teamBuff)\..*\.pen_$/.test(receiverPath))
    return 'penetration_ratio' as const
  if (/(ownBuff|notOwnBuff|teamBuff)\..*\.laceration_dmg_?$/.test(receiverPath))
    return 'laceration_damage' as const
  if (/(ownBuff|notOwnBuff|teamBuff)\..*\.sharp_dmg_?$/.test(receiverPath))
    return 'sharp_damage_bonus' as const
  if (/(ownBuff|notOwnBuff|teamBuff)\..*\.sheer_dmg_?$/.test(receiverPath))
    return 'sheer_damage_bonus' as const
  if (/(ownBuff|notOwnBuff|teamBuff)\..*\.sheerForce$/.test(receiverPath))
    return 'sheer_force' as const
  if (/(ownBuff|notOwnBuff|teamBuff)\..*\.direct_dmg_?$/.test(receiverPath))
    return 'direct_damage_bonus' as const
  if (/(ownBuff|notOwnBuff|teamBuff)\..*\.buff_?$/.test(receiverPath)) return 'buff_bonus' as const
  if (/enemyDebuff\..*\.dmgInc_?$/.test(receiverPath)) return 'vulnerability' as const
  if (/(ownBuff|notOwnBuff|teamBuff)\..*\.mv_mult_?$/.test(receiverPath))
    return 'motion_value_multiplier' as const
  if (/(ownBuff|notOwnBuff|teamBuff)\..*\.def_?$/.test(receiverPath))
    return receiverPath.endsWith('_') ? ('defense_percent' as const) : ('defense_flat' as const)
  if (/enemyDebuff\..*\.defRed_?$/.test(receiverPath)) return 'defense_reduction' as const
  if (/ownBuff\..*\.defIgn_?$/.test(receiverPath)) return 'defense_ignore' as const
  if (/enemyDebuff\..*\.resRed_?/.test(receiverPath)) return 'resistance_reduction' as const
  if (/(ownBuff|notOwnBuff|teamBuff)\..*\.resIgn_?/.test(receiverPath))
    return 'resistance_ignore' as const
  if (/(ownBuff|notOwnBuff|teamBuff)\..*\.crit_dmg_?$/.test(receiverPath))
    return 'crit_damage' as const
  if (/(ownBuff|notOwnBuff|teamBuff)\..*\.crit_?(\.|$)/.test(receiverPath))
    return 'crit_rate' as const
  if (/(ownBuff|notOwnBuff|teamBuff)\..*\.atk_$/.test(receiverPath))
    return 'attack_percent' as const
  if (/(ownBuff|notOwnBuff|teamBuff)\..*\.atk(\.|$)/.test(receiverPath))
    return 'attack_flat' as const
  if (/(ownBuff|notOwnBuff|teamBuff)\..*\.hp_$/.test(receiverPath)) return 'hp_percent' as const
  if (/(ownBuff|notOwnBuff|teamBuff)\..*\.hp$/.test(receiverPath)) return 'hp_flat' as const
  if (/(ownBuff|teamBuff|enemyDebuff)\..*(common_dmg_|dmgInc_|\.dmg_|\.buff_$)/.test(receiverPath))
    return 'damage_bonus' as const
  return 'outside_direct_event_formula' as const
}

export function emptyModifiers(): DirectDamageModifiers {
  return {
    attackPercent: 0,
    attackFlat: 0,
    defensePercent: 0,
    defenseFlat: 0,
    hpPercent: 0,
    hpFlat: 0,
    lacerationDamage: 0,
    sharpDamageBonus: 0,
    sheerForce: 0,
    sheerDamageBonus: 0,
    directDamageBonus: 0,
    buffBonus: 0,
    vulnerability: 0,
    stunDamageBonus: 0,
    motionValueMultiplier: 0,
    critRate: 0,
    critDamage: 0,
    damageBonus: 0,
    defenseReduction: 0,
    defenseIgnore: 0,
    resistanceReduction: 0,
    resistanceIgnore: 0,
    penetrationRatio: 0,
  }
}

export function addModifier(
  target: DirectDamageModifiers,
  bucket: SourceBackedPlanningEffectBucket,
) {
  if (bucket.application === 'outside_direct_event_formula') return
  if (bucket.application === 'attack_percent') target.attackPercent += bucket.value
  if (bucket.application === 'attack_flat') target.attackFlat += bucket.value
  if (bucket.application === 'defense_percent') target.defensePercent += bucket.value
  if (bucket.application === 'defense_flat') target.defenseFlat += bucket.value
  if (bucket.application === 'hp_percent') target.hpPercent += bucket.value
  if (bucket.application === 'hp_flat') target.hpFlat += bucket.value
  if (bucket.application === 'laceration_damage') target.lacerationDamage += bucket.value
  if (bucket.application === 'sharp_damage_bonus') target.sharpDamageBonus += bucket.value
  if (bucket.application === 'sheer_force') target.sheerForce += bucket.value
  if (bucket.application === 'sheer_damage_bonus') target.sheerDamageBonus += bucket.value
  if (bucket.application === 'direct_damage_bonus') target.directDamageBonus += bucket.value
  if (bucket.application === 'buff_bonus') target.buffBonus += bucket.value
  if (bucket.application === 'vulnerability') target.vulnerability += bucket.value
  if (bucket.application === 'stun_damage_bonus') target.stunDamageBonus += bucket.value
  if (bucket.application === 'motion_value_multiplier') target.motionValueMultiplier += bucket.value
  if (bucket.application === 'crit_rate') target.critRate += bucket.value
  if (bucket.application === 'crit_damage') target.critDamage += bucket.value
  if (bucket.application === 'damage_bonus') target.damageBonus += bucket.value
  if (bucket.application === 'defense_reduction') target.defenseReduction += bucket.value
  if (bucket.application === 'defense_ignore') target.defenseIgnore += bucket.value
  if (bucket.application === 'resistance_reduction') target.resistanceReduction += bucket.value
  if (bucket.application === 'resistance_ignore') target.resistanceIgnore += bucket.value
  if (bucket.application === 'penetration_ratio') target.penetrationRatio += bucket.value
}

export function matchesEventScope(
  bucket: Pick<
    SourceBackedPlanningEffectBucket,
    'applicationScope' | 'effectId' | 'attribute' | 'damageType' | 'action'
  >,
  event: {
    actionId: string
    skill: string
    damageType?: string
    eventModifierRefs?: readonly string[]
  },
  memberAttribute: string,
) {
  if (
    bucket.applicationScope === 'event_only' &&
    (!bucket.effectId || !event.eventModifierRefs?.includes(bucket.effectId))
  )
    return false
  if (bucket.attribute && bucket.attribute !== memberAttribute) return false
  if (bucket.damageType && bucket.damageType !== event.damageType) return false
  if (!bucket.action) return true
  if (bucket.action === 'basic_attack')
    return event.skill === 'basic' && !event.actionId.startsWith('DashAttack')
  if (bucket.action === 'basic')
    return event.skill === 'basic' && !event.actionId.startsWith('DashAttack')
  if (bucket.action === 'dash') return event.actionId.startsWith('DashAttack')
  if (bucket.action === 'dodge_counter') return event.actionId.startsWith('DodgeCounter')
  if (bucket.action === 'ex_special') return event.actionId.startsWith('EXSpecialAttack')
  if (bucket.action === 'chain') return event.actionId.startsWith('ChainAttack')
  if (bucket.action === 'ultimate') return event.actionId.startsWith('Ultimate')
  return false
}
