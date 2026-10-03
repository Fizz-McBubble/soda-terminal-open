import { describe, expect, it } from 'vitest'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { stableContentHash } from '../gameDataPacks/types'
import {
  getReviewedNormalM0UseScope,
  resolveReviewedUseScope,
  type ExistingFact,
} from './reviewedRetentionUseScope'
import { resolveActionUtility } from './absoluteDiscRetentionActionUtility'
import { resolveRetentionUseFacts } from './absoluteDiscRetentionUseFacts'
import adoptions from './reviewed-normal-use-adoptions.v1.json'

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
  const scope = getReviewedNormalM0UseScope(constraint, actor, binding.goals[0]!, contract)!
  return { binding, constraint, contract, scope }
}
describe('source-bound ordinary M0 reserve policy', () => {
  for (const binding of adoptions.rows) {
    it(`${binding.actorAgentId}: exact adopted goal preserves unresolved physical tag`, () => {
      const { scope, constraint, contract } = inputs(binding.actorAgentId)
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
        resolveRetentionUseFacts(constraint, binding.actorAgentId).actions.aftershock!.state,
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
      const { contentHash, ...payload } = c
      expect(row.profileFingerprint).toBe(stableContentHash(payload))
      expect(contentHash).toBe(row.profileFingerprint)
    }
  })
})
