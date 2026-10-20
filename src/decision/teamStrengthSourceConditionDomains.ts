import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { stableContentHash } from '../gameDataPacks/types'
import { sourceSeeds } from '../calculation/currentPlanningConditionSourceSeeds32'
import { teamStrengthSourceConditionDomains } from './teamStrengthSourceConditionDomains.data'
import { planningAnomalyLifecycleHash32 } from '../calculation/currentPlanningAnomalyLifecycleIdentity32'
export { teamStrengthSourceConditionDomains } from './teamStrengthSourceConditionDomains.data'

const anomalyTimeSeed = sourceSeeds.find(
  (seed) => seed.kind === 'common' && seed.key === 'anomaly',
)!
export const teamStrengthSourceConditionDomainsIdentity = stableContentHash({
  agentDomains: teamStrengthSourceConditionDomains,
  anomalyTimeSeed,
  anomalyTimePolicy: 'explicit-event-elapsed-time-only; no-maximum-or-zero-default',
  anomalyLifecycle: planningAnomalyLifecycleHash32,
})
export function teamStrengthSourceConditionDomain(agentId: string, referenceKey: string) {
  const row = teamStrengthSourceConditionDomains.find((row) => row.agentId === agentId)
  const contract = getCurrentAgentEventContract(agentId)
  // A time observation is not a stack-capacity maximum. Reuse the already
  // locked common anomaly domain, but require an actual event observation.
  if (
    referenceKey === 'anomTimePassed' &&
    contract?.source.commit === '3456cd0f6f5bea10e168074502460dac2fcd6df4'
  ) {
    const domain = anomalyTimeSeed.conditionals.anomTimePassed!
    return {
      providerAgentId: agentId,
      referenceKey,
      label: referenceKey,
      valueKind: 'number' as const,
      minimum: domain.min,
      maximum: domain.max,
      integerOnly: domain.int_only === true,
      explicitOnly: true,
      options: undefined,
      sourceRefs: [
        `${anomalyTimeSeed.formulaPath}#sha256=${anomalyTimeSeed.formulaHash}`,
        `${anomalyTimeSeed.metaPath}#sha256=${anomalyTimeSeed.metaHash}`,
      ],
    }
  }
  if (
    !row ||
    contract?.source.commit !== row.commit ||
    contract.source.formulaSha256 !== row.formulaSha256 ||
    contract.upstreamKey !== row.upstreamKey
  )
    return null
  const domain = (
    row.conditions as Readonly<
      Record<
        string,
        {
          sheet: string
          name: string
          type: string
          min?: number
          max?: number
          int_only?: boolean
          list?: readonly (string | number)[]
        }
      >
    >
  )[referenceKey]
  if (!domain || domain.sheet !== row.upstreamKey || domain.name !== referenceKey) return null
  return {
    providerAgentId: agentId,
    referenceKey,
    label: referenceKey,
    valueKind:
      domain.type === 'num'
        ? ('number' as const)
        : domain.type === 'bool'
          ? ('boolean' as const)
          : ('enum' as const),
    minimum: domain.min,
    maximum: domain.max,
    integerOnly: domain.int_only === true,
    options: domain.list?.map((value) => ({ value, label: String(value) })),
    sourceRefs: [
      row.url,
      row.path + '#sha256=' + row.sha256,
      'license:MIT; existing src/upstream/genshinOptimizer/NOTICE.md',
    ],
  }
}
