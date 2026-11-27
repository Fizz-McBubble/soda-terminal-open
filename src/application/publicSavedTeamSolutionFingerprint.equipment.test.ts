import { describe, expect, it } from 'vitest'
import {
  savedGraduationPlan,
  savedGraduationExecution,
  savedGraduationDiscs,
} from '../testing/savedTeamGraduationCompletion.testFixture'
import {
  buildSavedTeamPlanSolutionFingerprintFromComponents,
  materialCompetingPlan,
} from './publicSavedTeamSolutionFingerprint'
import { contentHash } from './contentHash'
import { compileAgentBuildIntent } from '../decision/buildIntent'
import { buildIntentFingerprintMatches } from './publicBuildIntentFingerprint'
import { createEmptyRoster } from '../assault/catalog'
import { normalizeTeamPortfolioPreference } from '../accounts/teamPortfolioPreference'

describe('stored plan equipment identity', () => {
  it('fits the same saved source identity before and after persistence and keeps legacy plans readable', () => {
    const memberIds = ['agent-severian', 'agent-norma', 'agent-astra'] as const
    const discs = savedGraduationDiscs(memberIds)
    const execution = savedGraduationExecution(memberIds)
    const plan = savedGraduationPlan(execution, memberIds, discs)
    plan.candidateWarehouse = {
      scope: 'team',
      totalScore: 0,
      boundary: '',
      loadouts: execution.members.map(({ agentId, suggested }) => ({
        agentId,
        totalScore: 0,
        discIds: suggested.discIds,
        effectiveRolls: 0,
        setPattern: '4+2',
        degraded: false,
      })),
    }
    const decisionInput = {
      warehouse: {
        accountId: plan.accountId,
        account: null,
        roster: createEmptyRoster(plan.updatedAt),
        discs,
      },
      drafts: [plan],
      activePlanIds: {},
      developmentPriorityAgentIds: [],
      preference: normalizeTeamPortfolioPreference(undefined),
    }
    const input = {
      decisionInput,
      planId: plan.id,
      buildIntentFingerprint: 'same-intent',
      nonPlanningComponents: {},
    }
    const legacy = buildSavedTeamPlanSolutionFingerprintFromComponents(input)
    expect(
      buildSavedTeamPlanSolutionFingerprintFromComponents({
        ...input,
        candidateWarehouse: plan.candidateWarehouse,
      }),
    ).toBe(legacy)

    const revised = structuredClone(plan)
    revised.candidateWarehouse!.loadouts[0]!.reviewedDiscAlternative = {
      id: 'community-dawns-bloom-salon',
      sourceHash: 'fnv1a-12345678',
    }
    const before = buildSavedTeamPlanSolutionFingerprintFromComponents({
      ...input,
      candidateWarehouse: revised.candidateWarehouse,
    })
    expect(before).not.toBe(legacy)
    expect(
      buildSavedTeamPlanSolutionFingerprintFromComponents({
        ...input,
        decisionInput: { ...decisionInput, drafts: [revised] },
      }),
    ).toBe(before)
    expect(contentHash(materialCompetingPlan(revised))).not.toBe(
      contentHash(materialCompetingPlan(plan)),
    )
  })

  it('invalidates a competing plan identity when its saved engine growth changes', () => {
    const ids = ['agent-remielle', 'agent-aria', 'agent-velina'] as const
    const plan = savedGraduationPlan(savedGraduationExecution(ids), ids, savedGraduationDiscs(ids))
    const changed = structuredClone(plan)
    changed.teamExecutionSnapshot!.members[0]!.suggested.wEngine!.level = 10
    changed.teamExecutionSnapshot!.members[0]!.suggested.wEngine!.ascension = 0
    expect(contentHash(materialCompetingPlan(changed))).not.toBe(
      contentHash(materialCompetingPlan(plan)),
    )
  })

  it.each([
    'source-priority-compatible-objective-incumbent-exchange-r5',
    'legal-slot-menu-white-qualified-nonstacking-four-piece-r4',
    'explicit-branch-priority-r1',
    'explicit-branch-priority-shared-four-piece-once-r2',
    'legal-slot-fixed-branch-priority-shared-four-piece-once-r3',
  ])('preserves exact %s snapshots without treating them as a current solve', (branchPolicy) => {
    const intent = compileAgentBuildIntent({ agentId: 'agent-remielle' })
    const { fingerprint, ...facts } = intent
    const old = {
      ...facts,
      fingerprint: contentHash({
        ...facts,
        discScoring: 'actual-disc-values-s-standard-r1',
        branchPolicy,
      }),
    }
    expect(buildIntentFingerprintMatches(old)).toBe(false)
    expect(old.fingerprint).not.toBe(fingerprint)
    expect(buildIntentFingerprintMatches(old, true)).toBe(true)
    expect(
      buildIntentFingerprintMatches(
        { ...old, constraints: { ...old.constraints, excludedDiscIds: ['tampered-disc'] } },
        true,
      ),
    ).toBe(false)
  })
})
