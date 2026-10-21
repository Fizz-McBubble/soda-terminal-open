import { describe, expect, it } from 'vitest'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { stableContentHash } from '../gameDataPacks/types'
import {
  getReviewedNormalM0UseScope,
  reviewedNormalM0ProfileFingerprint,
  resolveReviewedUseScope,
  type ExistingFact,
} from './reviewedRetentionUseScope'
import { resolveActionUtility } from './absoluteDiscRetentionActionUtility'
import { resolveRetentionUseFacts } from './absoluteDiscRetentionUseFacts'
import adoptions from './reviewed-normal-use-adoptions.v1.json'
import { absoluteDiscRetentionCatalog } from './absoluteDiscRetentionCatalog'

// Direct production imports bind current contracts and full constraint digests.
const unresolved: ExistingFact = {
  action: 'aftershock',
  mechanicalPresence: 'unresolved',
  utility: 'missing_fact',
  predicateId: 'test-unresolved-physical-tag',
}
function inputs(actor: string) {
  const binding = adoptions.rows.find((row) => row.actorAgentId === actor)!
  const constraint = getCandidateWarehouseConstraint(actor)!
  const contract = getCurrentAgentEventContract(actor)!
  const selectedSetPlan = binding.reviewedSetPlanHashes
    ? constraint.setPlans?.find((plan) =>
        binding.reviewedSetPlanHashes?.includes(stableContentHash(plan)),
      )
    : undefined
  const scope = getReviewedNormalM0UseScope(
    constraint,
    actor,
    binding.goals[0]!,
    contract,
    selectedSetPlan,
  )!
  return { binding, constraint, contract, scope, selectedSetPlan }
}
describe('source-bound ordinary M0 reserve policy', () => {
  for (const actor of ['agent-zhao', 'agent-remielle']) {
    it(`${actor}: reviewed constraint changes preserve the exact ordinary scope`, () => {
      const { binding, constraint, contract, scope } = inputs(actor)
      expect(scope).toBeDefined()
      expect(binding.constraintReadoption?.comparisonBaselineCommit).toBe('1fc905f1')
      expect(binding.constraintReadoption?.currentFingerprint).toBe(binding.profileFingerprint)
      expect(binding.constraintReadoption?.preservedSourceBindings).toEqual({
        sourceCommit: binding.sourceCommit,
        formulaSha256: binding.formulaSha256,
        statsSha256: binding.statsSha256,
        reviewedSourceArtifactSha256: binding.reviewedSourceArtifactSha256,
      })
      expect(scope.review.primaryAction).toBeNull()
      expect(scope.review.decision).toBe('aftershock_not_adopted_for_this_build')
      // A reviewed identity migration or source addition is not a wildcard for later drift.
      for (const changed of [
        { ...constraint, agentId: `candidate-3.1-${actor}` },
        {
          ...constraint,
          sources: constraint.sources.map((source, index) =>
            index === 0 ? { ...source, contentHash: 'unreviewed-source' } : source,
          ),
        },
        { ...constraint, setIds: [...constraint.setIds, 'set-unreviewed'] },
      ]) {
        expect(
          getReviewedNormalM0UseScope(changed, actor, binding.goals[0]!, contract),
        ).toBeUndefined()
      }
      if (actor === 'agent-zhao') {
        expect(constraint.setPlans).toHaveLength(3)
        const changed = {
          ...constraint,
          setPlans: constraint.setPlans!.map((plan, index) =>
            index === 2 ? { ...plan, purpose: 'recommended' as const } : plan,
          ),
        }
        expect(
          getReviewedNormalM0UseScope(changed, actor, binding.goals[0]!, contract),
        ).toBeUndefined()
      }
    })
  }
  for (const binding of adoptions.rows) {
    it(`${binding.actorAgentId}: exact adopted goal preserves unresolved physical tag`, () => {
      const { scope, constraint, contract, selectedSetPlan } = inputs(binding.actorAgentId)
      expect(scope).toBeDefined()
      const result = resolveReviewedUseScope(
        unresolved,
        scope.context,
        scope.review,
        scope.adoption,
      )
      expect(result.applied).toBe(true)
      expect(result.utility).toBe('incidental')
      expect(result.mechanicalPresence).toBe('unresolved')
      expect(scope.context.mindscape).toBe(0)
      expect(scope.review.gameVersion).toBe('3.2')
      expect(scope.review.summary).toContain('非账户影画事实')
      const physicalUtility = resolveActionUtility(
        'aftershock',
        binding.actorAgentId,
        constraint,
        contract,
        [],
      )
      expect(physicalUtility.state).toBe('missing_fact')
      const productionUtility = resolveActionUtility(
        'aftershock',
        binding.actorAgentId,
        constraint,
        contract,
        [],
        scope,
      )
      expect(productionUtility.state).toBe('incidental')
      expect(productionUtility.evidenceIds).toContain(`reviewed-use:${binding.adoptionId}`)
      expect(productionUtility.evidenceIds).toContain(
        `reviewed-source-sha256:${binding.reviewedSourceArtifactSha256}`,
      )
      expect(
        resolveRetentionUseFacts(constraint, binding.actorAgentId, undefined, selectedSetPlan)
          .actions.aftershock!.state,
      ).toBe('incidental')
    })
    it(`${binding.actorAgentId}: boundaries preserve existing utilities`, () => {
      const { scope, constraint, contract } = inputs(binding.actorAgentId)
      for (const patch of [
        { gameVersion: '3.1' },
        { mode: 'special_mode' as const },
        { mindscape: 1 },
        { mindscape: 6 },
        { mindscape: 7 },
        { modifiers: ['special-potential'] },
        { goal: 'unknown' },
        { actorAgentId: 'other-agent' },
        { profileFingerprint: 'changed' },
        { sourceCommit: '0'.repeat(40) },
        { formulaSha256: '0'.repeat(64) },
        { statsSha256: '0'.repeat(64) },
      ])
        expect(
          resolveReviewedUseScope(
            unresolved,
            { ...scope.context, ...patch },
            scope.review,
            scope.adoption,
          ).applied,
        ).toBe(false)
      for (const fact of [
        { ...unresolved, mechanicalPresence: 'present' as const, utility: 'conditional' as const },
        { ...unresolved, utility: 'valid' as const },
        {
          ...unresolved,
          action: 'dash' as const,
          mechanicalPresence: 'present' as const,
          utility: 'conditional' as const,
        },
      ])
        expect(
          resolveReviewedUseScope(fact, scope.context, scope.review, scope.adoption).applied,
        ).toBe(false)
      expect(
        resolveReviewedUseScope(unresolved, scope.context, scope.review, {
          ...scope.adoption,
          approved: false,
        }).applied,
      ).toBe(false)
      expect(reviewedNormalM0ProfileFingerprint(constraint)).toBe(binding.profileFingerprint)
      const weightPayload = {
        ...constraint,
        subStatWeights: { ...constraint.subStatWeights, hp_flat: 999 },
      }
      expect(
        getReviewedNormalM0UseScope(
          { ...weightPayload, contentHash: stableContentHash(weightPayload) },
          binding.actorAgentId,
          binding.goals[0]!,
          contract,
        ),
      ).toBeUndefined()
      const mutated = {
        ...constraint,
        mainStats: { ...constraint.mainStats, '4': ['def_percent' as const] },
      }
      expect(
        getReviewedNormalM0UseScope(mutated, binding.actorAgentId, binding.goals[0]!, contract),
      ).toBeUndefined()
      expect(
        resolveActionUtility('aftershock', binding.actorAgentId, mutated, contract, [], scope)
          .state,
      ).toBe('missing_fact')
      expect(
        getReviewedNormalM0UseScope(constraint, binding.actorAgentId, binding.goals[0]!, {
          ...contract,
          source: { ...contract.source, statsSha256: '0'.repeat(64) },
        }),
      ).toBeUndefined()
      for (const patch of [
        { repository: 'https://example.invalid' },
        { formulaPath: 'wrong.ts' },
        { statsPath: 'wrong.json' },
      ])
        expect(
          getReviewedNormalM0UseScope(constraint, binding.actorAgentId, binding.goals[0]!, {
            ...contract,
            source: { ...contract.source, ...patch },
          }),
        ).toBeUndefined()
    })
  }
  it('Sigrid adopts only complete reviewed Basic branches and preserves unknown Ultimate scope', () => {
    const { constraint, contract, binding, scope } = inputs('agent-sigrid')
    expect(
      getReviewedNormalM0UseScope(constraint, 'agent-sigrid', 'crit_damage', contract),
    ).toBeUndefined()
    for (const plan of constraint.setPlans!) {
      const adopted = binding.reviewedSetPlanHashes!.includes(stableContentHash(plan))
      const actual = getReviewedNormalM0UseScope(
        constraint,
        'agent-sigrid',
        'crit_damage',
        contract,
        plan,
      )
      expect(Boolean(actual)).toBe(adopted)
      const facts = resolveRetentionUseFacts(constraint, 'agent-sigrid', undefined, plan)
      expect(facts.actions.aftershock!.state).toBe(adopted ? 'incidental' : 'missing_fact')
      if (adopted) expect(facts.actions.basic!.state).toBe('valid')
      expect(
        getReviewedNormalM0UseScope(constraint, 'agent-sigrid', 'crit_damage', contract, {
          ...plan,
          sourceText: 'unreviewed rotation',
        }),
      ).toBeUndefined()
    }
    for (const selectedSetPlanHash of [
      undefined,
      'unknown',
      stableContentHash(constraint.setPlans![1]),
    ]) {
      expect(
        resolveReviewedUseScope(
          unresolved,
          { ...scope.context, selectedSetPlanHash },
          scope.review,
          { ...scope.adoption, selectedSetPlanHash },
        ).applied,
      ).toBe(false)
    }
    const altered = { ...constraint, setPlans: [] }
    expect(
      getReviewedNormalM0UseScope(
        altered,
        'agent-sigrid',
        'crit_damage',
        contract,
        constraint.setPlans![0],
      ),
    ).toBeUndefined()
  })
  it('catalog passes exact Sigrid base plans without adopting Ultimate or main alternatives', () => {
    const profiles = absoluteDiscRetentionCatalog.profiles.filter(
      (p) => p.agentId === 'agent-sigrid',
    )
    const base = profiles.filter((p) => p.id.includes(':base-'))
    expect(base).toHaveLength(3)
    for (const profile of base) {
      const isUltimate = Object.hasOwn(profile.fourPieceUses ?? {}, 'set-puffer-electro')
      expect(profile.utilityEvidence?.['action:aftershock']?.state).toBe(
        isUltimate ? 'missing_fact' : 'incidental',
      )
      if (!isUltimate) expect(profile.actionUtility?.basic).toBe('valid')
    }
    for (const profile of profiles.filter((p) => !p.id.includes(':base-'))) {
      expect(
        profile.utilityEvidence?.['action:aftershock']?.evidenceIds.some((id) =>
          id.startsWith('reviewed-use:normal32-continuity:1591'),
        ),
      ).not.toBe(true)
    }
  })
  it('three reviewed basic goals gain utility only for present actions', () => {
    for (const actor of ['agent-ye-shunguang', 'agent-pyrois', 'agent-sigrid']) {
      const { scope } = inputs(actor)
      const result = resolveReviewedUseScope(
        {
          action: 'basic',
          mechanicalPresence: 'present',
          utility: 'incidental',
          predicateId: 'generic',
        },
        scope.context,
        scope.review,
        scope.adoption,
      )
      expect(result.utility).toBe('valid')
      expect(result.applied).toBe(true)
      expect(
        resolveReviewedUseScope(
          { ...unresolved, action: 'basic' },
          scope.context,
          scope.review,
          scope.adoption,
        ).applied,
      ).toBe(false)
    }
  })
  it('production resolver never changes other actor aftershock or independent dash', () => {
    const { scope } = inputs('agent-sigrid')
    for (const actor of ['agent-trigger', 'agent-soldier-0-anby', 'agent-harumasa']) {
      const c = getCandidateWarehouseConstraint(actor)!,
        contract = getCurrentAgentEventContract(actor)
      for (const action of ['aftershock', 'dash'] as const)
        expect(resolveActionUtility(action, actor, c, contract, [], scope)).toEqual(
          resolveActionUtility(action, actor, c, contract, []),
        )
      expect(
        resolveActionUtility(
          actor === 'agent-harumasa' ? 'dash' : 'aftershock',
          actor,
          c,
          contract,
          [],
        ).state,
      ).toBe('valid')
    }
  })
  it('base adoption fingerprints are exact full constraints, not actor labels', () => {
    for (const row of adoptions.rows) {
      const c = getCandidateWarehouseConstraint(row.actorAgentId)!
      expect(row.profileFingerprint).toBe(reviewedNormalM0ProfileFingerprint(c))
      const withoutGuidance = { ...c }
      delete withoutGuidance.guidanceApplicability
      expect(reviewedNormalM0ProfileFingerprint(withoutGuidance)).toBe(row.profileFingerprint)
      expect(stableContentHash({ ...withoutGuidance, guidanceApplicability: 'changed' })).not.toBe(
        row.profileFingerprint,
      )
    }
  })
})
