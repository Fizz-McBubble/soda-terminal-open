import type { CurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'

/** This is the ordering of the adopted finite packet, not a guessed animation
 * timeline. The first cannon contact does not receive the RES reduction it
 * triggers. The three-member policy places Claret before Roxy and Koleda after. */
import { reviewedRoxyPreparedTriggersIdentity32 } from './reviewedRoxyPreparedTriggersIdentity32'

export function bindReviewedRoxyPreparedTriggers32(input: {
  entry: CurrentAgentPlanningEffectBlueprint
  ownerAgentId: string
  eventId: string
  references?: Readonly<Record<string, unknown>>
}) {
  const overrides: Record<string, boolean> = {}
  const inactive = {
    status: 'supported' as const,
    active: false,
    overrides,
    sourceRefs: [] as string[],
  }
  const policy = input.references?.roxyPreparedHeld32
  if (
    input.entry.providerAgentId !== 'agent-roxy' ||
    !['agent-roxy:m1_resRed_', 'agent-roxy:m2_stun_'].includes(input.entry.effectKey) ||
    policy === undefined
  )
    return inactive
  const identity = reviewedRoxyPreparedTriggersIdentity32
  const source = getCurrentAgentEventContract('agent-roxy')?.source
  if (
    !['personal', 'claret_roxy_koleda'].includes(String(policy)) ||
    source?.commit !== identity.commit ||
    source.formulaSha256 !== identity.formulaSha256 ||
    !input.entry.sourceRefs.includes(`${identity.formulaPath}#${identity.formulaSha256}`)
  )
    return { status: 'unsupported' as const, blockers: ['洛克茜准备态触发顺序与锁定来源不符。'] }

  const own = input.ownerAgentId === 'agent-roxy'
  const laterAlly = policy === 'claret_roxy_koleda' && input.ownerAgentId === 'agent-koleda'
  const afterRelease =
    own &&
    (input.eventId === 'special.SpecialAttackForgiveMeForNotSeeingYouOff.hit-0' ||
      input.eventId.startsWith('special.EyeOfTheStorm.'))
  const afterChill = own && input.eventId !== 'special.EXSpecialAttackDontCatchAChill.hit-0'
  if (input.entry.effectKey === 'agent-roxy:m1_resRed_')
    overrides.kindlyHits = afterRelease || laterAlly
  else overrides.chillHits = afterChill || laterAlly
  return {
    status: 'supported' as const,
    active: true,
    overrides,
    sourceRefs: [
      `${identity.formulaPath}#sha256=${identity.formulaSha256}`,
      `${identity.localizationPath}#sha256=${identity.localizationSha256}`,
      `prepared-trigger-order:${identity.revision}`,
    ],
  }
}
