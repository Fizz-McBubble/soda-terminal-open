import type { AstraCoreAttackState32 } from './reviewedAstraCoreAttack32'

/** A controlled fixture, never an automatic production preparation. */
export function declaredAstraCore32(
  incomingAgentId: string,
  enabled: boolean,
): AstraCoreAttackState32 {
  const sourceRefs = ['test:one-eligible-entry-with-25-energy-no-prior-grants']
  return enabled
    ? {
        kind: 'single_handoff',
        incomingAgentId,
        entry: 'quick_assist',
        cadenzaAtTrigger: true,
        energyBefore: 25,
        elapsedSeconds: { minimumInclusive: 0, maximumExclusive: 20 },
        sourceRefs,
      }
    : { kind: 'no_prior_grant', sourceRefs }
}
