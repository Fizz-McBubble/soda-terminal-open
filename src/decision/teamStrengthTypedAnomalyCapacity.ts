import { currentAgentPlanningEffectBlueprints } from '../calculation/currentAgentPlanningEffectBlueprint'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import {
  effectReceiverMetadata,
  requiredReferences,
} from '../calculation/currentPlanningEffectExpressions'
import {
  effectRuntimeReferences,
  planningProviderReferences32,
} from '../calculation/currentPlanningEffectDomain'
import {
  createPlanningExpressionDomainRuntime,
  evaluateUpstreamExpressionIr,
  extractUpstreamEffectValueIr,
  type UpstreamExpressionIR,
} from '../calculation/currentUpstreamExpressionIR'
import { stableContentHash } from '../gameDataPacks/types'
import type { TeamStrengthCapacityContext } from './teamStrengthSourceCapacityActions'
import type { CapacityEffect } from './teamStrengthSourceCapacityPolicy'
import { baseReferenceExpression } from './teamStrengthSupportExpression'

export const teamStrengthTypedAnomalyCapacityPolicy = {
  unit: 'single_declared_abloom_fraction_of_original_attribute_anomaly_damage',
  ordinaryDirectContact: false,
  windRestoration: {
    commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
    formulaSha256: '89933DF78C2479BAEAD0CF1EC9100332815D549C7DBAB5DFC911EA896392500E',
    path: 'libs/zzz/dm-localization/assets/locales/en/char_Vivian_gen.json',
    sha256: '23e0d9adbf300d3aec88b61f96fcc82f8aa2b3b6ab0d77ca6aaf1625b1e1a0a4',
    locator: '/core/desc/6/0',
    valueSource: 'existing locked runtimeDefaults dm.core.dmg_wind and dm.core.anomProf_step',
  },
} as const
export const teamStrengthTypedAnomalyCapacityIdentity = stableContentHash(
  teamStrengthTypedAnomalyCapacityPolicy,
)

/** Typed anomaly capacities never enter an ordinary attack's modifier buckets.
 * A single prepared trigger is compared; feathers, frequency and anomaly owner
 * shares remain outside this capacity coordinate. */
export function projectTeamStrengthTypedAnomalyCapacity(context: TeamStrengthCapacityContext) {
  const { members, contactRuntime, counts, conditions, gaps } = context
  const effects: CapacityEffect[] = []
  for (const provider of members) {
    const contract = getCurrentAgentDecisionMechanicContract(provider.agentId)!.effectContract
    const actor = contactRuntime.get(provider.agentId)!
    const entries = currentAgentPlanningEffectBlueprints
      .filter(
        (entry) =>
          entry.providerAgentId === provider.agentId &&
          /^core_/.test(entry.effectId) &&
          entry.numericExpression.sourceStatus === 'upstream_expression_available' &&
          !entry.numericExpression.todoBoundary &&
          effectReceiverMetadata(entry.numericExpression.expressionIr).damageType === 'abloom',
      )
      .map((entry) => ({
        key: entry.effectKey,
        expression: entry.numericExpression.expressionIr,
        sourceRefs: entry.sourceRefs,
      }))
    const ice = entries.find((entry) => entry.key === 'agent-vivian:core_ice_abloom')
    const pin = teamStrengthTypedAnomalyCapacityPolicy.windRestoration
    if (
      ice &&
      contract.source.commit === pin.commit &&
      contract.source.formulaSha256 === pin.formulaSha256 &&
      Array.isArray(contract.runtimeDefaults.references['dm.core.dmg_wind'])
    ) {
      // The retained text and stat table explicitly contain Wind. The pinned
      // formula sheet omitted only this receiver; retain that restoration's
      // provenance instead of pretending it was an upstream formula entry.
      const expression = JSON.parse(
        JSON.stringify(ice.expression)
          .replaceAll('teamBuff.dmg.anom_mv_mult_.ice', 'teamBuff.dmg.anom_mv_mult_.wind')
          .replaceAll('dm.core.dmg_ice', 'dm.core.dmg_wind'),
      ) as UpstreamExpressionIR
      entries.push({
        key: 'agent-vivian:reviewed_wind_abloom32',
        expression,
        sourceRefs: [...ice.sourceRefs, `${pin.path}#${pin.sha256}:${pin.locator}`],
      })
    }
    for (const entry of entries) {
      const metadata = effectReceiverMetadata(entry.expression)
      const attribute = metadata.receiverPath?.split('.').at(-1)
      const extracted = extractUpstreamEffectValueIr(entry.expression)
      if (extracted.status !== 'supported') continue
      const chosen = conditions.supportReferencesByAgentId?.[provider.agentId]?.abloom ?? true
      if (typeof chosen !== 'boolean') {
        gaps.push({
          providerAgentId: provider.agentId,
          effectKey: entry.key,
          fields: ['invalid_source_condition:abloom'],
          sourceRefs: entry.sourceRefs,
        })
        continue
      }
      for (const target of members) {
        if (
          target.specialty !== 'anomaly' ||
          target.attribute !== attribute ||
          !target.actionFacts.anomaly
        )
          continue
        const declared = { abloom: chosen }
        const expression = baseReferenceExpression(
          extracted.value as UpstreamExpressionIR,
          planningProviderReferences32({
            member: actor,
            sourceReferences: contract.runtimeDefaults.references,
            attributeCounts: counts.attribute,
            observations: declared,
          }),
        )
        const references = effectRuntimeReferences({
          target: contactRuntime.get(target.agentId)!,
          requiredReferences: requiredReferences(expression),
          baseReferences: planningProviderReferences32({
            member: actor,
            sourceReferences: contract.runtimeDefaults.references,
            attributeCounts: counts.attribute,
            observations: declared,
          }),
        })
        const result = evaluateUpstreamExpressionIr(
          expression,
          createPlanningExpressionDomainRuntime({
            references,
            teamCounts: { specialty: counts.specialty, faction: counts.faction },
          }),
        )
        if (
          result.status !== 'supported' ||
          typeof result.value !== 'number' ||
          !Number.isFinite(result.value) ||
          result.value < 0
        ) {
          gaps.push({
            providerAgentId: provider.agentId,
            effectKey: entry.key,
            fields:
              result.status === 'unsupported' ? result.blockers : ['nonfinite_abloom_fraction'],
            sourceRefs: entry.sourceRefs,
          })
          continue
        }
        effects.push({
          providerAgentId: provider.agentId,
          recipientAgentId: target.agentId,
          effectKey: entry.key,
          application: 'motion_value_multiplier',
          value: result.value,
          relativeGain: null,
          sourceRefs: entry.sourceRefs,
          conditions: declared,
          channel: 'abloom',
        })
      }
    }
  }
  return effects
}
