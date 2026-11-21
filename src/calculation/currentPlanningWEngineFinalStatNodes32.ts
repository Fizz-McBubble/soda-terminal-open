import { stableContentHash } from '../gameDataPacks/types'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { statReferences, type PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'
import type { SourceBackedPlanningEffectBucket } from './currentPlanningDamageModifiers'
import {
  planningEffectWrittenStats32,
  type PlanningEffectGraphNode32,
} from './currentPlanningEffectGraph32'
import { bindCurrentWEngineFormulaRuntime } from './currentWEnginePersonalPlanningEffects'
import {
  getCurrentFormulaWEngineEffectEntries,
  resolveCurrentFormulaWEngineContract,
} from './currentFormulaMechanicContracts'
import { planningWEngineEffectScope } from './currentPlanningWEngineDependencies32'

export function appendPlanningWEngineFinalStatNodes32(
  scoped: readonly SourceBackedPlanningEffectBucket[],
  members: readonly PlanningEffectRuntimeMember[],
  nodes: PlanningEffectGraphNode32[],
  dependency: (agentId: string, stat: string) => string,
) {
  for (const bucket of scoped.filter((row) => row.sourceFormula)) {
    const source = bucket.sourceFormula!
    const provider = members.find((member) => member.agentId === bucket.providerAgentId)
    if (!provider)
      return { status: 'unsupported' as const, blockers: ['音擎来源节点缺少真实成员。'] }
    const reviewed = getCurrentFormulaWEngineEffectEntries(source.engineId).find(
      (row) => row.effectIndex === source.effectIndex,
    )
    const staticSource = getCurrentWEngineStaticData(source.engineId)
    const formulaSha256 = staticSource?.source.formulaSha256
    const specialty = getCurrentAgentEventContract(provider.agentId)?.identity.specialty
    const scope = reviewed
      ? planningWEngineEffectScope(reviewed.path.split('.').slice(1).join('.'), reviewed.action)
      : null
    if (
      !reviewed ||
      !staticSource ||
      staticSource.source.provider === 'nanoka' ||
      !formulaSha256 ||
      staticSource.specialty !== (specialty === 'attack' ? 'damage' : specialty) ||
      !scope ||
      scope.application !== bucket.application ||
      scope.action !== bucket.action ||
      scope.attribute !== bucket.attribute ||
      stableContentHash(reviewed.finalStatReferences) !==
        stableContentHash(source.finalStatReferences) ||
      !bucket.sourceRefs.some((ref) => ref.endsWith(formulaSha256))
    )
      return {
        status: 'unsupported' as const,
        blockers: ['音擎最终属性来源描述与锁定公式不一致。'],
      }
    nodes.push({
      id: `${bucket.bucketId}:${bucket.recipientAgentIds.join(',')}`,
      reads: source.finalStatReferences.flatMap((ref) =>
        ref.startsWith('own.')
          ? [dependency(provider.agentId, ref.slice(10))]
          : bucket.recipientAgentIds.map((id) => dependency(id, ref.slice(13))),
      ),
      writes: planningEffectWrittenStats32(bucket),
      evaluate: (stats) => {
        const bound = bindCurrentWEngineFormulaRuntime({
          agentId: provider.agentId,
          engineId: source.engineId,
          member: provider,
          runtime: source.runtime,
          targetAgentId: bucket.recipientAgentIds[0],
          eventFinalStats: stats[provider.agentId],
        })
        if (bound.blockers.length) return { status: 'unsupported', blockers: bound.blockers }
        const numbers = {
          ...bound.numbers,
          ...Object.fromEntries(
            Object.entries(
              statReferences('target.final', stats[bucket.recipientAgentIds[0]!]!),
            ).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
          ),
        }
        const result = resolveCurrentFormulaWEngineContract({
          stableId: source.engineId,
          refinement: source.refinement,
          specialtyMatches: true,
          runtimePolicy: 'strict',
          runtime: { ...bound, numbers },
          effectIndices: [source.effectIndex],
        })
        if (result.status !== 'supported') return result
        const value = result.effects[0]?.value ?? 0
        return typeof value !== 'number' || !Number.isFinite(value)
          ? { status: 'unsupported', blockers: ['音擎最终属性表达式无效。'] }
          : { status: 'supported', buckets: [{ ...bucket, value }] }
      },
    })
  }
  return null
}
