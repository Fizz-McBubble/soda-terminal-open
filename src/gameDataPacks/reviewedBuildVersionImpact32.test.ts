import { describe, expect, it } from 'vitest'
import { getCurrentBuildAuthorityProfile } from './currentBuildAuthority'
import {
  reviewedBuildImpactBranches32,
  getReviewedBuildVersionImpact32,
} from './reviewedBuildVersionImpact32'
import { evaluateCurrentAgentTeamActivation } from '../calculation/currentAgentMechanicContracts'
import {
  createLevel60NeutralEffectRuntimeMember,
  evaluateCurrentPlanningFormationEffects,
} from '../calculation/currentPlanningEffectRuntime'
import { currentCapabilityGapMatrix } from './currentCapabilityGapMatrix'

function impact(id: string) {
  return getCurrentBuildAuthorityProfile(id)!.guidance.fields.find(
    (field) => field.fieldId === 'build.version_change_impact',
  )!
}

describe('reviewed 3.2 build impact production adoption', () => {
  it('maps the source count changes and unchanged coefficients to named adopted fields', () => {
    for (const id of ['agent-miyabi', 'agent-nekomata', 'agent-piper', 'agent-koleda'] as const) {
      const field = impact(id)
      expect(field.state).toBe('ready')
      expect(field.value).toMatchObject({
        disposition: 'named_branches_reviewed',
        branchMappings: reviewedBuildImpactBranches32[id],
      })
      const value = field.value as { adoptedBuildFields: { fieldPath: string; value: unknown }[] }
      expect(value.adoptedBuildFields.map((row) => row.fieldPath)).toContain(
        'build.team_bangboo_scenario',
      )
      expect(value.adoptedBuildFields.map((row) => row.fieldPath)).toContain('build.main_sub_stats')
      expect(new Set(value.adoptedBuildFields.map((row) => row.fieldPath)).size).toBe(
        value.adoptedBuildFields.length,
      )
    }
    expect(reviewedBuildImpactBranches32['agent-miyabi'][0].retainedValues).toEqual({
      commonDamage: 0.6,
      fallenFrost: 2,
      iceResistanceIgnore: 0.3,
    })
    expect(reviewedBuildImpactBranches32['agent-nekomata'][0].retainedValues).toEqual({
      exSpecialDamagePerAssault: 0.35,
      maxAssaultStacks: 2,
    })
    expect(reviewedBuildImpactBranches32['agent-piper'][0].retainedValues).toEqual({
      powerThreshold: 20,
      teamCommonDamage: 0.18,
    })
  })

  it('uses real teammate consumers for expansion and potential-gated counterexamples', () => {
    const active = (stableId: string, other: string, potentialImage = 0) =>
      evaluateCurrentAgentTeamActivation({
        stableId,
        memberIds: [stableId, other],
        agentState: { potentialImage },
      })
    expect(active('agent-miyabi', 'agent-grace')).toMatchObject({
      status: 'supported',
      active: true,
    })
    expect(active('agent-miyabi', 'agent-zhu-yuan')).toMatchObject({
      status: 'supported',
      active: false,
    })
    expect(active('agent-nekomata', 'agent-astra', 0)).toMatchObject({
      status: 'supported',
      active: false,
    })
    expect(active('agent-nekomata', 'agent-astra', 1)).toMatchObject({
      status: 'supported',
      active: true,
    })
    expect(active('agent-piper', 'agent-grace')).toMatchObject({
      status: 'supported',
      active: true,
    })
    expect(
      evaluateCurrentAgentTeamActivation({ stableId: 'agent-piper', memberIds: ['agent-piper'] }),
    ).toMatchObject({ status: 'supported', active: false })
    expect(active('agent-koleda', 'agent-claret')).toMatchObject({
      status: 'supported',
      active: true,
    })
  })

  it.each([1, 2, 3, 4, 5, 6])(
    'matches Koleda potential %s with actual split recipient values',
    (potential) => {
      const memberIds: readonly [string, string, string] = [
        'agent-koleda',
        'agent-claret',
        'agent-roxy',
      ]
      const result = evaluateCurrentPlanningFormationEffects({
        memberIds,
        members: memberIds.map((id) => ({
          ...createLevel60NeutralEffectRuntimeMember(id),
          potential: id === 'agent-koleda' ? potential : 0,
          coreLevel: 7,
        })),
      })
      expect(result.status).toBe('supported')
      if (result.status !== 'supported') throw new Error(JSON.stringify(result))
      const laceration = result.results.find(
        (row) => row.effectKey === 'agent-koleda:potential_laceration_dmg_',
      )!
      const crit = result.results.find(
        (row) => row.effectKey === 'agent-koleda:potential_crit_dmg_',
      )!
      expect(laceration).toMatchObject({
        status: 'supported',
        recipientValues: expect.arrayContaining([
          { agentId: 'agent-claret', value: [0, 0.04, 0.06, 0.08, 0.1, 0.12][potential - 1] },
          { agentId: 'agent-roxy', value: 0 },
        ]),
      })
      expect(crit).toMatchObject({
        status: 'supported',
        recipientValues: expect.arrayContaining([
          { agentId: 'agent-roxy', value: [0, 0.11, 0.17, 0.23, 0.29, 0.35][potential - 1] },
          { agentId: 'agent-claret', value: 0 },
        ]),
      })
    },
  )

  it('reviews new agents current panels and configurations without inventing old numeric values', () => {
    for (const id of ['agent-claret', 'agent-roxy']) {
      expect(impact(id).value).toMatchObject({
        baseVersion: null,
        disposition: 'new_agent_current_fields_reviewed',
        numericSourceComparison: null,
      })
      const value = impact(id).value as {
        adoptedBuildFields: { fieldPath: string; value: unknown; conditions: string[] }[]
      }
      const target = value.adoptedBuildFields.find((row) => row.fieldPath === 'build.target_panel')!
      expect(target.value).toEqual(
        getCurrentBuildAuthorityProfile(id)!.guidance.fields.find(
          (row) => row.fieldId === 'build.target_panel',
        )!.value,
      )
      expect(target.conditions.join(' ')).toContain(id === 'agent-claret' ? '128.9%' : '3.12')
    }
  })

  it('closes the real gap-matrix consumer while preserving bounded scope and account gates', () => {
    expect(impact('agent-anby').value).toMatchObject({
      disposition: 'no_change_in_locked_actor_formula_and_raw',
      rankingReview: 'not_claimed',
      formalPromotion: false,
    })
    expect(getReviewedBuildVersionImpact32('unknown', [])).toBeUndefined()
    for (const row of currentCapabilityGapMatrix.rows) {
      expect(
        row.build.fields.find((field) => field.fieldId === 'build.version_change_impact'),
      ).toMatchObject({ status: 'ready', blockers: [], nextEvidence: [] })
      const profile = getCurrentBuildAuthorityProfile(row.stableId)!
      const value = impact(row.stableId).value as {
        adoptedBuildFields: { fieldPath: string; value: unknown; authorityState: string }[]
      }
      for (const selected of value.adoptedBuildFields) {
        const adopted = profile.guidance.fields.find(
          (field) => field.fieldId === selected.fieldPath,
        )!
        expect(selected.value).toEqual(adopted.value)
        expect(selected.authorityState).toBe(adopted.state)
      }
    }
    for (const id of ['agent-miyabi', 'agent-claret'])
      expect(getCurrentBuildAuthorityProfile(id)!.calculation.state).toBe(
        'account_snapshot_required',
      )
  })
})
