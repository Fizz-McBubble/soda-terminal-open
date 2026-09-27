import type { TeamPredicate } from '../teamEngine/contracts'
import type { getL3AgentDevelopmentEvidence } from './l3ProductionProjection'

export type ReviewedExternalSupportChannel =
  | 'attack_from_source_initial_attack'
  | 'combat_attack_flat'
  | 'all_damage_bonus'
  | 'critical_damage_bonus'
  | 'electric_defense_ignore'
  | 'enemy_stun_damage_multiplier'
  | 'enemy_stun_duration'

export type ReviewedSupportEligibility = {
  minimumMindscape: 0
  additionalAbilityRequired: boolean
  teamPredicate: TeamPredicate | null
  runtimeStateIds: readonly string[]
  requiresCombatTrigger: boolean
  magnitudeBoundary: 'max_core_only' | 'core_independent' | 'core_level_1_only'
}

export type ReviewedSupportSource = {
  url: string
  location: string
  observedOn: '2026-09-23'
  lastKitReviewPatch: '2.5' | '2.6' | '2.7' | '3.0'
  unit: string
}

export type ReviewedExternalSupportEffect = {
  channel: ReviewedExternalSupportChannel
  recipient: 'team' | 'team_state_members' | 'enemy'
  recipientAttribute?: 'electric'
  trigger: string
  stateId?: string
  value: Readonly<Record<string, number | string>>
  durationSeconds: number | null
  levelBoundary: string
  consumerBoundary: string
  eligibility: ReviewedSupportEligibility
  reviewedSource: ReviewedSupportSource
}

export type ReviewedExternalSupportFact = {
  schema: 'soda-reviewed-external-support-fact/v2'
  agentId: string
  status: 'source_bound_candidate'
  intendedTargetGameVersion: '3.1'
  targetVersionStatus:
    | 'historical_source_snapshot_unverified_for_3.1'
    | 'source_label_current_without_pinned_game_version'
    | 'selected_3.1_fields_compared'
  targetVersionReview: {
    url: string
    sourceVersion: '3.1'
    checkedAt: string
    contentSha256: string
    selectedFields: readonly { locator: string; coreLevel: number }[]
    matchedClauses: number
    boundary: string
  }
  sourcePackageId: string
  sourcePackageSha256: string
  sourceRecordIds: readonly string[]
  sourceFieldPaths: readonly string[]
  sourceIds: readonly string[]
  sourceLocators: readonly string[]
  sourceVersions: readonly string[]
  sourceUnits: readonly (string | null)[]
  sourceEvidenceHash: string
  effects: readonly ReviewedExternalSupportEffect[]
  boundary: string
}

export type EvidenceRow = NonNullable<
  ReturnType<typeof getL3AgentDevelopmentEvidence>
>['candidateFacts'][number]

export type RequiredRow = Pick<
  EvidenceRow,
  'recordId' | 'fieldPath' | 'evidenceLocator' | 'value' | 'gameVersion' | 'unit'
> & { sourceIds: readonly string[] }

export type FactDefinition = {
  agentId: string
  targetVersionStatus: ReviewedExternalSupportFact['targetVersionStatus']
  requiredRows: readonly RequiredRow[]
  effects: readonly ReviewedExternalSupportEffect[]
  boundary: string
}

export function prydwenSource(
  agent: 'sunna' | 'zhao' | 'norma' | 'nangong-yu' | 'cissia',
  lastKitReviewPatch: ReviewedSupportSource['lastKitReviewPatch'],
  location: string,
  unit: string,
): ReviewedSupportSource {
  return {
    url: `https://www.prydwen.gg/zenless/characters/${agent}`,
    location,
    observedOn: '2026-09-23',
    lastKitReviewPatch,
    unit,
  }
}
