import type { ReviewedBangbooRecoveryBinding } from '../gameDataPacks/reviewedBangbooRecoverySemantics'

export type BangbooBaseUtilityType =
  | 'hp_restore'
  | 'shield'
  | 'energy_flat'
  | 'energy_regen'
  | 'damage_bonus'

export type BangbooBaseUtilityUnit =
  | 'hp_ratio_bangboo_hp'
  | 'shield_ratio_bangboo_hp'
  | 'hp_ratio_target_hp'
  | 'hp_ratio_unresolved_basis'
  | 'energy_point'
  | 'energy_point_per_second'
  | 'damage_ratio'

export type BangbooUtilityReceiver =
  | 'on_field_agent'
  | 'pickup_agent'
  | 'target_agent'
  | 'triggering_agent'
  | 'off_field_agents'

export type BangbooTargetRestriction = 'standard_energy_only' | 'none'

export interface BangbooBaseUtilitySpec {
  readonly paramIndex: number
  readonly hpBasis?: 'bangboo_max_hp' | 'unresolved'
  readonly utilityType: BangbooBaseUtilityType
  readonly unit: BangbooBaseUtilityUnit
  readonly mechanic: string
  readonly targetAction: string
  readonly receiver: BangbooUtilityReceiver
  readonly targetRestriction: BangbooTargetRestriction
  readonly trigger: string
  readonly capacityOnly: boolean
  readonly branchId?: string
  readonly branchSelection?: string
  readonly branchDescription?: string
  readonly probabilityUnstated?: boolean
  readonly probabilityDynamic?: boolean
  readonly summonCount?: number
  readonly filmCharges?: number
  readonly maxTriggersPerBattle?: number
  readonly durationSeconds?: number
  readonly cooldownIndex?: number
  readonly durationIndex?: number
}

export interface BangbooBaseUtilityEntityDefinition {
  readonly stableId: string
  readonly gameId: string
  readonly playerName: string
  readonly englishName: string
  readonly skillName: string
  readonly descriptionSnippet: string
  readonly cooldownSeconds: number
  readonly durationSeconds?: number
  readonly effects: readonly BangbooBaseUtilitySpec[]
}

export interface BangbooBaseUtilityOutput {
  readonly operator: 'resource_and_sustain_apply'
  readonly mechanic: string
  readonly action: 'active'
  readonly skillRole: 'active'
  readonly skillName: string
  readonly utilityType: BangbooBaseUtilityType
  readonly unit: BangbooBaseUtilityUnit
  readonly provider: 'bangboo'
  readonly receiver: BangbooUtilityReceiver
  readonly targetRestriction: BangbooTargetRestriction
  readonly targetAction: string
  readonly trigger: string
  readonly capacityOnly: boolean
  readonly value: number
  /** Source ratio stays in value; this capacity requires an explicit level/ascension pair. */
  readonly absoluteValue?: number
  readonly absoluteUnit?: 'hp_point' | 'shield_point'
  readonly ascensionLevelCap?: 10 | 20 | 30 | 40 | 50 | 60
  readonly hpBasisEvidence?: ReviewedBangbooRecoveryBinding
  readonly additionalAbilityEvidence?: {
    readonly level: number
    readonly parameterPointer: string
    readonly rawLevelParam: string
    readonly semanticSha256: string
    readonly operators: readonly string[]
  }
  readonly values: readonly number[]
  readonly skillLevel: number
  readonly bangbooLevel: number
  readonly hpBasis?: 'bangboo_max_hp' | 'unresolved'
  readonly paramIndex: number
  readonly rawParameterToken: string
  readonly branchId?: string
  readonly branchSelection?: string
  readonly branchDescription?: string
  readonly probabilityUnstated?: boolean
  readonly probabilityDynamic?: boolean
  readonly summonCount?: number
  readonly filmCharges?: number
  readonly maxTriggersPerBattle?: number
  readonly durationSeconds?: number
  readonly cooldownSeconds?: number
  readonly sourceEvidence: {
    readonly stableId: string
    readonly gameId: string
    readonly playerName: string
    readonly englishName: string
    readonly skillName: string
    readonly rawLevelParam: string
    readonly descriptionSnippet: string
    readonly url: string
    readonly sha256: string
    readonly semanticSha256: string
    readonly parameterPointer: string
  }
}

export interface ResolveBangbooBaseUtilityInput {
  readonly stableId: string
  readonly skillLevel: number
  readonly bangbooLevel: number
  readonly ascensionLevelCap?: 10 | 20 | 30 | 40 | 50 | 60
}
