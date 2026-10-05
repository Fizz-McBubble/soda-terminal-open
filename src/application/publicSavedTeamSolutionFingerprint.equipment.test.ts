import { describe, expect, it } from 'vitest'
import {
  savedGraduationPlan,
  savedGraduationExecution,
  savedGraduationDiscs,
} from '../testing/savedTeamGraduationCompletion.testFixture'
import { materialCompetingPlan } from './publicSavedTeamSolutionFingerprint'
import { contentHash } from './contentHash'
import { compileAgentBuildIntent } from '../decision/buildIntent'
import { buildIntentFingerprintMatches } from './publicBuildIntentFingerprint'

describe('stored plan equipment identity', () => {
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
