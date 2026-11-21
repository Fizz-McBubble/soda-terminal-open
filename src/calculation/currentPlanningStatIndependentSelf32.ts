import { currentAgentPlanningEffectBlueprints } from './currentAgentPlanningEffectBlueprint'
import { effectReceiverMetadata } from './currentPlanningEffectExpressions'
import { panMeridianFlowEffectKey32 } from './currentPlanningDamageModifiers'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'
import { compileCurrentPlanningSelfEffects32 } from './currentPlanningSelfEffects32'
import {
  extractUpstreamEffectValueIr,
  type UpstreamExpressionIR,
} from './currentUpstreamExpressionIR'
import { reviewedPotentialParameterBlueprints } from './reviewedPotentialEffectBlueprints'
import { isReviewedTemplateMechanicEffect32 } from './reviewedTemplateMechanicEffects32'
import { currentPlanningConsumerPolicyIdentity32 } from './currentPlanningConsumerPolicyIdentity32'

// These identities bind the audited non-IR consumer chain, not the data proof.
// Updating one requires re-auditing hidden stat reads and the comparison tests.
const auditedConsumers: Readonly<Record<string, string>> = {
  './personalSourceSelfShare32.ts': 'fnv1a-52238cf6',
  './currentPlanningSelfEffects32.ts': 'fnv1a-ef5b3c47',
  './currentPlanningEffectRuntime.ts': 'fnv1a-2ac11d92',
  './currentPlanningFormationEffectEvaluation.ts': 'fnv1a-6593a3fc',
  './currentPlanningEffectObservation32.ts': 'fnv1a-86f15110',
  './planningKnownInactiveEffects32.ts': 'fnv1a-6a897ec4',
  './currentPlanningEffectDomain.ts': 'fnv1a-386aeb25',
  './currentPlanningEffectExpressions.ts': 'fnv1a-6820e5ac',
  './currentUpstreamExpressionIR.ts': 'fnv1a-3fb6f732',
  './reviewedTemplateMechanicEffects32.ts': 'fnv1a-dc0b814d',
  './reviewedRoxyEnergyConversion32.ts': 'fnv1a-bbb426d3',
  './reviewedCommunityPlayConditions32.ts': 'fnv1a-16c10784',
  './currentPlanningAnomalyLifecycle32.ts': 'fnv1a-9a9b82dc',
  './currentPlanningAnomalyLifecycleIdentity32.ts': 'fnv1a-941d0ebc',
  './currentPlanningDamageModifiers.ts': 'fnv1a-50f8d128',
  './currentAgentMechanicContracts.ts': 'fnv1a-8388e459',
  './currentAgentDecisionMechanicContracts.ts': 'fnv1a-fd52afb8',
  '../assault/agentCapabilities.ts': 'fnv1a-b7702cbf',
  '../gameDataPacks/reviewedTeammateActivationMinimum.ts': 'fnv1a-324e10f9',
  '../gameDataPacks/reviewedPotentialTeamActivation.ts': 'fnv1a-abfaeac4',
  '../gameDataPacks/reviewedSourceBoundAdditionalAbility.ts': 'fnv1a-3596b9dd',
  './currentPlanningTeamDpsRuntime.ts': 'fnv1a-3b06fd93',
  '../optimizer/candidateEffectiveCritObjective.ts': 'fnv1a-457b7fe4',
}

type Scalar = string | number | boolean | null
const scalar = (value: unknown): value is Scalar =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value))

// Only these expression forms have been proved independent of equipment stats.
function statIndependent(node: UpstreamExpressionIR): boolean {
  if (node.kind === 'literal') return scalar(node.value)
  if (node.kind === 'reference')
    return (
      !/^(own|target|team|dm)(\.|$)/.test(node.path) &&
      (!node.path.startsWith('char.') ||
        /^char\.(core|mindscape|potential|basic|dodge|assist|special|chain|lvl)$/.test(node.path))
    )
  if (node.kind === 'array') return node.items.every(statIndependent)
  if (node.kind === 'call')
    return (
      !node.receiver &&
      ['cmpEq', 'subscript', 'abilityCheck'].includes(node.operator) &&
      node.arguments.every(statIndependent)
    )
  return false
}

export function hasStatIndependentReviewedSelf32(agentId: string): boolean {
  if (
    Object.entries(auditedConsumers).some(
      ([path, hash]) => currentPlanningConsumerPolicyIdentity32.sourceHashes[path] !== hash,
    )
  )
    return false
  const entries = currentAgentPlanningEffectBlueprints.filter(
    (entry) => entry.providerAgentId === agentId,
  )
  if (
    !entries.length ||
    reviewedPotentialParameterBlueprints.some((entry) => entry.providerAgentId === agentId)
  )
    return false
  return entries.every((entry) => {
    const metadata = effectReceiverMetadata(entry.numericExpression.expressionIr)
    const expression = extractUpstreamEffectValueIr(entry.numericExpression.expressionIr)
    return (
      isReviewedTemplateMechanicEffect32(entry) &&
      entry.targetKinds.length === 1 &&
      entry.targetKinds[0] === 'self' &&
      metadata.receiverPath?.startsWith('ownBuff.') &&
      !metadata.receiverPath.includes('.initial.') &&
      !entry.recipientBinding &&
      entry.effectKey !== panMeridianFlowEffectKey32 &&
      !['core_atk', 'core_impact'].includes(entry.effectId) &&
      expression.status === 'supported' &&
      statIndependent(expression.value as UpstreamExpressionIR)
    )
  })
}

type Input = Parameters<typeof compileCurrentPlanningSelfEffects32>[0]
type Result = ReturnType<typeof compileCurrentPlanningSelfEffects32>
type Key = Array<string | number | boolean | null | undefined>

function keyFor(member: PlanningEffectRuntimeMember, references: Input['references']): Key | null {
  if (
    member.statBasis32 !== 'out_of_combat' ||
    !Number.isFinite(member.level) ||
    !Number.isFinite(member.mindscape) ||
    !Number.isFinite(member.coreLevel) ||
    (member.potential != null && !Number.isFinite(member.potential))
  )
    return null
  const skills = Object.entries(member.skillLevels)
  const refs = Object.entries(references ?? {})
  if (
    skills.some(([, value]) => !Number.isFinite(value)) ||
    refs.some(([, value]) => !scalar(value))
  )
    return null
  return [
    member.agentId,
    member.level,
    member.mindscape,
    member.potential,
    member.coreLevel,
    member.statBasis32,
    skills.length,
    ...skills.flatMap(([key, value]) => [key, value]),
    references === undefined,
    refs.length,
    ...refs.flatMap(([key, value]) => [key, value as Scalar]),
  ]
}

/** Scoped to one synchronous solve with immutable source, growth and observations. */
export function createStatIndependentSelfCompiler32() {
  const eligibility = new Map<string, boolean>()
  const cache: Array<{ key: Key; result: Result }> = []
  return (input: Input): Result => {
    const agentId = input.member.agentId
    if (!eligibility.has(agentId))
      eligibility.set(agentId, hasStatIndependentReviewedSelf32(agentId))
    const key = eligibility.get(agentId) ? keyFor(input.member, input.references) : null
    const match =
      key &&
      cache.find(
        (item) =>
          item.key.length === key.length &&
          item.key.every((value, index) => Object.is(value, key[index])),
      )
    if (match) return match.result
    const result = compileCurrentPlanningSelfEffects32(input)
    if (key && result.status === 'supported') {
      if (cache.length === 64) cache.shift()
      cache.push({ key, result })
    }
    return result
  }
}
