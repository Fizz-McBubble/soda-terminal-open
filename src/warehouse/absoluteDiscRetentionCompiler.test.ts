import { describe, expect, it } from 'vitest'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import {
  candidateSetPlansForConstraint,
  getCandidateWarehouseConstraint,
} from '../gameDataPacks/candidateWarehouseConstraints'
import { reviewedTeamDiscDirections } from '../gameDataPacks/reviewedTeamDiscConditions'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import { stableContentHash } from '../gameDataPacks/types'
import { resolveActionUtility } from './absoluteDiscRetentionActionUtility'
import { resolveRetentionActionFact } from './absoluteDiscRetentionActionFacts'
import { absoluteDiscRetentionCatalog } from './absoluteDiscRetentionCatalog'
import { sourcedFunctionalMains } from './absoluteDiscRetentionFunctions'
import { twoPieceApplicability } from './absoluteDiscRetentionKernel'
import { resolveRetentionUseFacts } from './absoluteDiscRetentionUseFacts'

const constraint = (id: string) => getCandidateWarehouseConstraint(id)!
const facts = (id: string) => resolveRetentionUseFacts(constraint(id), id)

describe('retention compiler source boundaries', () => {
  it('compiles every production 2+2+2 branch without four-piece uses or exclusive functions', () => {
    const catalog = absoluteDiscRetentionCatalog
    let threePairCount = 0
    let fourPlusTwoCount = 0
    for (const agentId of catalog.releasedAgentIds) {
      const base = constraint(agentId)
      for (const [index, plan] of candidateSetPlansForConstraint(base).entries()) {
        const id = `${agentId}:base-${index}:${stableContentHash(plan).slice(0, 10)}`
        const profile = catalog.profiles.find((row) => row.id === id)!
        expect(profile, id).toBeDefined()
        const fourPieceIds = plan.pattern === '4+2' ? plan.primarySetIds : []
        expect(Object.keys(profile.fourPieceUses ?? {}), id).toEqual(fourPieceIds)
        if (plan.pattern === '4+2') {
          fourPlusTwoCount++
          continue
        }
        threePairCount++
        // Some adopted recipes list alternatives for their three two-piece roles.
        expect(plan.primarySetIds.length).toBeGreaterThanOrEqual(3)
        expect(profile.functionalMains).toEqual(
          sourcedFunctionalMains(
            base,
            agentId,
            [],
            base.sources
              .filter((source) => source.verified)
              .map((source) => `${source.id}:${source.contentHash}`)[0]!,
            profile.goal,
          ),
        )
        // Two-piece utility still comes from each physical set's independent effects.
        for (const setId of plan.primarySetIds) {
          const set = catalog.sets.find((row) => row.id === setId)!
          expect(set, setId).toBeDefined()
          expect(twoPieceApplicability(set, profile)).toBeDefined()
        }
      }
    }
    expect(threePairCount).toBeGreaterThan(0)
    expect(fourPlusTwoCount).toBeGreaterThan(0)
    for (const direction of reviewedTeamDiscDirections) {
      const id = `${resolveCurrentReleasedIdentity(direction.agentId)}:reviewed-${direction.id}`
      const profile = catalog.profiles.find((row) => row.id === id)!
      expect(Object.keys(profile.fourPieceUses ?? {}), id).toEqual(
        direction.setPlan.pattern === '4+2' ? direction.setPlan.primarySetIds : [],
      )
    }
  })

  it.each([
    ['同阵营队伍（无动作描述）', 'aftershock', 'incompatible'],
    ['同阵营队友可激活追加能力', 'aftershock', 'incompatible'],
    ['本人没有追加攻击能力', 'aftershock', 'incompatible'],
    ['队友发动追加攻击，本人仅负责辅助', 'aftershock', 'incompatible'],
    ['No aftershock damage in this build.', 'aftershock', 'incompatible'],
    ['普攻仅用于衔接，不是主要伤害来源', 'basic', 'incidental'],
  ] as const)('does not promote audit text "%s" into a self action fact', (text, action, state) => {
    const base = constraint('agent-nicole')
    const result = resolveActionUtility(
      action,
      'agent-nicole',
      {
        ...base,
        progressionDirection: [text],
        teamAndBangbooPreconditions: [text],
      },
      getCurrentAgentEventContract('agent-nicole'),
      [],
    )
    expect(result.state).toBe(state)
    expect(result.predicateId).not.toContain('primary')
    expect(result.evidenceIds.some((id) => id.includes('Nicole.ts'))).toBe(true)
  })

  it.each(['aftershock', 'basic', 'dash'] as const)(
    'preserves %s evidence gaps for an unknown actor',
    (action) => {
      const result = resolveActionUtility(
        action,
        'agent-unreviewed',
        {
          ...constraint('agent-nicole'),
          agentId: 'agent-unreviewed',
          progressionDirection: [
            '本人没有追加攻击能力；No aftershock damage; basic attack; dash attack',
          ],
        },
        null,
        [],
      )
      expect(result.state).toBe('missing_fact')
      expect(result.predicateId).toContain('actor_action_contract_missing')
    },
  )

  it('does not infer aftershock from abloom, set identity, or a teammate event contract', () => {
    expect(facts('agent-vivian').actions.aftershock!.state).toBe('incompatible')
    const base = constraint('agent-nicole')
    const altered = {
      ...base,
      setIds: ['set-shadow-harmony', 'set-dawns-bloom'],
      progressionDirection: ['aftershock is primary; 强化冲刺 dash attack; 普攻 basic attack'],
    }
    expect(
      resolveActionUtility(
        'aftershock',
        'agent-nicole',
        altered,
        getCurrentAgentEventContract('agent-nicole'),
        [],
      ).state,
    ).toBe('incompatible')
    expect(
      resolveActionUtility(
        'basic',
        'agent-nicole',
        altered,
        getCurrentAgentEventContract('agent-nicole'),
        [],
      ).state,
    ).toBe('incidental')
    expect(
      resolveActionUtility(
        'dash',
        'agent-nicole',
        altered,
        getCurrentAgentEventContract('agent-nicole'),
        [],
      ).state,
    ).toBe('incidental')
    expect(
      resolveActionUtility(
        'aftershock',
        'agent-nicole',
        altered,
        getCurrentAgentEventContract('agent-trigger'),
        [],
      ).state,
    ).toBe('missing_fact')
  })

  it.each([
    ['agent-ellen', 'basic'],
    ['agent-soldier-11', 'basic'],
    ['agent-billy', 'basic'],
    ['agent-zhu-yuan', 'basic'],
    ['agent-harumasa', 'dash'],
    ['agent-seed', 'basic'],
    ['agent-soldier-0-anby', 'aftershock'],
    ['agent-trigger', 'aftershock'],
    ['agent-trigger', 'basic'],
    ['agent-orphie-magus', 'aftershock'],
  ] as const)('retains source-bound production focus %s/%s', (id, action) => {
    const result = facts(id).actions[action]!
    expect(result.state).toBe('valid')
    expect(result.evidenceIds.some((source) => source.endsWith('reviewed-action-focus'))).toBe(true)
    const bound = resolveRetentionActionFact(
      action,
      id,
      constraint(id),
      getCurrentAgentEventContract(id),
    )
    expect(bound).toMatchObject({
      actorAgentId: id,
      actionTag: action,
      presence: 'present',
      currentBuildBenefit: 'primary',
      condition: { kind: 'source_rotation', binding: 'reviewed_build' },
    })
    expect(bound.sourceEvents.length).toBeGreaterThan(0)
  })

  it('does not carry a valid current-build focus to a different or unsourced direction', () => {
    for (const id of ['agent-ellen', 'agent-soldier-0-anby'] as const) {
      const action = id === 'agent-ellen' ? 'basic' : 'aftershock'
      const base = constraint(id)
      const altered = {
        ...base,
        progressionDirection: [
          'No aftershock damage in this build. 普攻仅用于衔接，不是主要伤害来源',
        ],
      }
      expect(
        resolveActionUtility(action, id, altered, getCurrentAgentEventContract(id), []).state,
      ).toBe(action === 'basic' ? 'incidental' : 'conditional')
      expect(
        resolveActionUtility(
          action,
          id,
          { ...base, sources: [] },
          getCurrentAgentEventContract(id),
          [],
        ).state,
      ).toBe('missing_fact')
    }
  })

  it('retains conditional self aftershock uses and explicit negative Seed classification', () => {
    for (const id of ['agent-ju-fufu', 'agent-lucia', 'agent-pulchra', 'agent-yuzuha']) {
      const resolved = facts(id)
      expect(resolved.actions.aftershock!.state, id).toBe('conditional')
      expect(resolved.actions.aftershock!.predicateId).toBe(
        'aftershock_current_build_benefit_unverified',
      )
    }
    expect(facts('agent-seed').actions.aftershock!.state).toBe('incompatible')
    expect(facts('agent-harumasa').actions.basic!.state).toBe('incidental')
    expect(facts('agent-nicole').actions.basic!.state).toBe('incidental')
    expect(facts('agent-nicole').actions.dash!.state).toBe('incidental')
  })

  it('leaves incomplete source tags as scoped gaps instead of rejecting the whole profile', () => {
    const profiles = absoluteDiscRetentionCatalog.profiles
    const missing = profiles.filter(
      (profile) => profile.utilityEvidence?.['action:aftershock']?.state === 'missing_fact',
    )
    expect(missing.length).toBeGreaterThan(0)
    for (const profile of missing) {
      expect(profile.verified).toBe(true)
      expect(profile.utilityEvidence?.['action:basic']?.state).not.toBe('missing_fact')
      expect(profile.utilityEvidence?.['action:dash']?.state).not.toBe('missing_fact')
      expect(Object.values(profile.effectUtility ?? {})).toContain('valid')
    }
  })

  it('invalidates a reviewed classification when the actor mechanic source changes', () => {
    const contract = getCurrentAgentEventContract('agent-nicole')!
    const changed = { ...contract, source: { ...contract.source, formulaSha256: 'unreviewed' } }
    expect(
      resolveActionUtility('aftershock', 'agent-nicole', constraint('agent-nicole'), changed, [])
        .state,
    ).toBe('missing_fact')
  })

  it.each([
    ['agent-ellen', 'basic'],
    ['agent-harumasa', 'dash'],
  ] as const)(
    'preserves the %s/%s fact gap when a source fingerprint or commit changes',
    (id, action) => {
      const contract = getCurrentAgentEventContract(id)!
      for (const source of [
        { ...contract.source, formulaSha256: 'unreviewed' },
        { ...contract.source, commit: 'unreviewed' },
      ]) {
        const changed = { ...contract, source }
        expect(resolveActionUtility(action, id, constraint(id), changed, []).state).toBe(
          'missing_fact',
        )
      }
    },
  )
})
