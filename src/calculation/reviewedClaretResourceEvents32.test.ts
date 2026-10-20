import { describe, expect, it } from 'vitest'
import { summarizeReviewedClaretResourceProduction32 } from './reviewedClaretResourceEvents32'
import { summarizeSourceResourceProduction32 } from './sourceResourceProduction32'
import contexts from '../gameDataPacks/reviewedDecision32Contexts.json'
import { getCurrentAgentDecisionMechanicContract } from './currentAgentDecisionMechanicContracts'

const row = {
  ownerAgentId: 'agent-claret',
  eventId: 'basic.BasicAttackBloodforgingFourForms.hit-0',
  skillLevel: 12,
  occurrenceCount: 1,
  evidenceRefs: ['declared:test-source-row'],
}
describe('release Claret action resource units', () => {
  it('keeps additive entry, passive and activation grants separate from source hit rows', () => {
    const result = summarizeReviewedClaretResourceProduction32([row])
    expect(result.knownResourceRules.sharpness).toMatchObject({
      automaticGainPerSecond: 1.5,
      battlefieldEntryAdditiveGain: 60,
      ultimateActivationGain: 10,
      exCost: 60,
      capacity: 120,
      capacityStatus: 'current_client_row_with_ex_cost_corroboration',
      initialBeforeEntryGrant: null,
    })
    expect(result.knownResourceRules.gash).toMatchObject({
      maximumStacks: 3,
      maimCostStacks: 1,
      counterAssistDirectGrantStacks: 1,
      bloodAxeBuildupRatioBonus: 0.5,
      maimConsumptionCondition: 'ByWoundStackCount>=1',
      maimConsumptionPerQualifyingHit: 1,
      buildupPerStack: null,
      perStackThresholdStatus: 'missing_after_reuse',
      durationAndDecayStatus: 'missing_after_reuse',
      observedBuildupPerStack: 1200,
      buildupStatus: 'pre_release_training_mode_observation_unmapped_units',
      buildupEvidence: {
        claimedVersion: '3.2.1',
        messageId: 2306,
        publishedAt: '2026-08-02T07:44:38Z',
        unit: 'reported Training Mode Gash buildup per stack; conversion to extracted row units is unknown',
      },
      excludedPreReleaseObservation: {
        buildupPerStack: 1200,
        status: 'benchmark_only',
      },
      mechanicSource: expect.arrayContaining([
        expect.objectContaining({
          path: 'Data/_unsorted/Claret_UniqueSkill.json',
          sha256: 'D0A5C47EDFE28682D83A4EC4E4148FB42D861C2E95F3770579605818B4EB936C',
        }),
        expect.objectContaining({
          path: 'Data/_unsorted/Claret_MaimWound.json',
          sha256: 'B5A7EF8D1B92F3FEE94D4645FF72283AC78433CDE8FE7A80B8E4E816F5F498FA',
        }),
      ]),
    })
    expect(result.knownResourceRules.crimsonInscription).toMatchObject({
      baseDurationSeconds: 16,
      pausesOffField: true,
      chainExtensionSeconds: 2,
      defeatHitWindowSeconds: 0.5,
      defeatExtensionSeconds: 3,
      defeatExtensionCooldownSeconds: 3,
    })
    expect(result).toMatchObject({
      baseSharpness: 0.946,
      activationGrantsRequireExplicitEvents: true,
      completeResourceCycle: false,
    })
    const flow = contexts.resourceContracts.find(
      (entry) => entry.agentId === 'agent-claret',
    )!.resourceFlow
    expect(flow.parameters.sharpness_ultimate_activation_gain).toBe(
      result.knownResourceRules.sharpness.ultimateActivationGain,
    )
    expect(flow.parameters.sharpness_cap).toBe(result.knownResourceRules.sharpness.capacity)
    expect(
      flow.resources.find((resource) => resource.resource === 'sharpness')?.stateParameterKeys,
    ).toContain('sharpness_cap')
    const compiled =
      getCurrentAgentDecisionMechanicContract('agent-claret')!.resourceContract!.resourceFlow
    expect(compiled.parameters).toEqual(flow.parameters)
    expect(compiled.transitionTemplates).toEqual(flow.transitionTemplates)
    expect(flow.parameters.crimson_inscription_defeat_extension_seconds).toBe(
      result.knownResourceRules.crimsonInscription.defeatExtensionSeconds,
    )
    expect(
      flow.transitionTemplates?.find((entry) => entry.eventKey === 'battle_entry')?.operation,
    ).toBe('add')
  })
  it('uses separate raw Gash and Sharpness scales, independently of skill level', () => {
    const result = summarizeReviewedClaretResourceProduction32([row])
    expect(result).toMatchObject({
      status: 'source_action_base_production',
      baseGash: 31.51,
      baseSharpness: 0.946,
      gashThreshold: null,
      gashThresholdEvidenceStatus: 'missing_after_reuse',
      observedGashThreshold: 1200,
      gashThresholdStatus: 'pre_release_training_mode_observation_unmapped_units',
      gashThresholdUnit: 'unmapped_observation_units',
      gashUnit: 'release_displayed_base_gash_buildup',
      sharpnessCapacity: 120,
      counterAssistDirectGrantStacks: 1,
      bloodAxeBuildupRatioBonus: 0.5,
      maimConsumptionPerQualifyingHit: 1,
      gashDurationAndDecayStatus: 'missing_after_reuse',
      completeResourceCycle: false,
    })
    expect(summarizeReviewedClaretResourceProduction32([{ ...row, skillLevel: 1 }])).toEqual(result)
    expect(
      summarizeReviewedClaretResourceProduction32([{ ...row, occurrenceCount: 3 }]),
    ).toMatchObject({ baseGash: 94.53, baseSharpness: 2.838 })
  })
  it('does not turn action Sharpness into Energy or call known production a complete cycle', () => {
    const result = summarizeSourceResourceProduction32({
      agentId: 'agent-claret',
      eventUsages: [row],
    })
    expect(result.claretActionProduction32).toMatchObject({
      status: 'source_action_base_production',
      baseGash: 31.51,
      baseSharpness: 0.946,
    })
    expect(result.gamePoints.energy).toBe(0)
    expect(result.resourceCycleStatus).toBe('unknown')
  })
  it.each([
    { ...row, eventId: 'missing-action' },
    { ...row, occurrenceCount: 0 },
    { ...row, ownerAgentId: 'agent-billy' },
  ])('rejects unknown source or quantity %j', (input) => {
    expect(summarizeReviewedClaretResourceProduction32([input])).toMatchObject({
      status: 'unknown',
      baseGash: null,
      baseSharpness: null,
    })
  })
})
