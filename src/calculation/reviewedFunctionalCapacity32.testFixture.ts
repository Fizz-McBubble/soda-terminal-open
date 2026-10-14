import { createLevel60NeutralEffectRuntimeMember } from './currentPlanningEffectRuntime'
import { evaluateReviewedFunctionalCapacity32 } from './reviewedFunctionalCapacity32'
import { projectNormalizedAccountFinalStatsDetailed } from '../decision/normalizedAccountFinalStats'
import { statWeightCalibrationFixture } from '../decision/developmentStatWeights.calibrationFixture'

export function member(agentId: string) {
  const value = createLevel60NeutralEffectRuntimeMember(agentId)
  value.coreLevel = 7
  value.potential = 0
  value.initialStats = { ...value.initialStats, atk: 3000, impact: 100, crit_: 0.6 }
  value.finalStats = { ...value.initialStats, atk: 9000 }
  return value
}

export const eventUsages = [
  {
    ownerAgentId: 'agent-dialyn',
    eventId: 'basic.BasicAttackHappyToBeOfService.hit-0',
    skillLevel: 12,
    occurrenceCount: 2,
    evidenceRefs: ['synthetic:declared-source-event-twice'],
  },
]

export function evaluate(
  actor: ReturnType<typeof member>,
  equipmentExclusions: readonly unknown[] = [],
) {
  const result = evaluateReviewedFunctionalCapacity32({
    member: actor,
    eventUsages,
    equipmentExclusions,
  })
  if (result.status !== 'supported') throw new Error(result.blockers.join(';'))
  return result.capacities
}

export function projectedDialyn() {
  const f = statWeightCalibrationFixture('agent-billy')
  const agent = {
    ...f.warehouse.roster.agents.find((row) => row.agentId === 'agent-billy')!,
    agentId: 'agent-dialyn',
  }
  const discs = structuredClone(f.discs)
  const first = discs[0]
  const crit = first.subStats.find((row) => row.stat === 'crit_rate')!
  const pen = first.subStats.find((row) => row.stat === 'pen')!
  crit.value = 14.4
  crit.upgrades = 5
  pen.value = 9
  pen.upgrades = 0
  const result = projectNormalizedAccountFinalStatsDetailed({
    agent,
    engineId: agent.wEngineDetails!.id!,
    discs,
  })
  if (result.status !== 'supported') throw new Error(result.reasons.join(';'))
  const actor = {
    ...member('agent-dialyn'),
    initialStats: result.stats.initialStats,
    finalStats: result.stats.finalStats,
  }
  return { agent, discs, actor, stats: result.stats }
}
