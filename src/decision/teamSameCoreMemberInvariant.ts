import { projectCommonMemberEquipmentRows } from '../calculation/commonMemberEquipmentProjection'
import { bindDeclaredTeamStrengthSupportInput } from './teamStrengthSupportContribution'
import { stableContentHash } from '../gameDataPacks/types'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import type { TeamSameCoreOutputEvidence } from './teamSameCoreOutputComparison'

function equipmentOwner(row: unknown) {
  if (!row || typeof row !== 'object') return null
  const value = row as Record<string, unknown>
  return value.providerAgentId ?? value.agentId ?? value.ownerAgentId ?? null
}

function commonMemberInvariant(
  bound: Extract<ReturnType<typeof bindDeclaredTeamStrengthSupportInput>, { status: 'ready' }>,
  commonMemberIds: readonly string[],
) {
  const subjectAgentId = bound.input.subjectAgentId
  const teamEvidenceRefs = new Set(bound.input.referenceConditions?.evidenceRefs ?? [])
  const commonMemberSet = new Set(commonMemberIds)
  return {
    subjectAgentId,
    eventUsages: bound.input.eventUsages,
    baseline: bound.input.baseline,
    eventObservation: bound.input.eventObservation ?? null,
    members: commonMemberIds.map((agentId) => {
      const build = bound.builds.find((row) => row.agentId === agentId)!
      return {
        agentId,
        sourceContract: getCurrentAgentEventContract(agentId)?.source,
        runtimeMember: bound.input.members.find((row) => row.agentId === agentId),
        referenceConditions: {
          mindscape: bound.input.referenceConditions?.mindscapeByAgentId?.[agentId],
          potential: bound.input.referenceConditions?.potentialByAgentId?.[agentId],
        },
        baselineReferences: bound.input.baselineReferencesByAgentId?.[agentId] ?? {},
        build: {
          equipment: build.equipment,
          limitations: build.limitations,
          // Team-level and character-guide bibliography is replacement-specific.
          // Formula, panel, equipment and catalog identities remain invariants.
          sourceRefs: build.sourceRefs
            .filter((ref) => !teamEvidenceRefs.has(ref) && !/^https?:\/\//i.test(ref))
            .sort(),
        },
      }
    }),
    equipmentEffects: projectCommonMemberEquipmentRows(
      bound.input.equipmentModifierBuckets.filter((row) => {
        const owner = equipmentOwner(row)
        return owner === null || commonMemberSet.has(String(owner))
      }),
      bound.input.memberIds,
      commonMemberIds,
    ),
    equipmentExclusions: projectCommonMemberEquipmentRows(
      bound.input.equipmentEffectExclusions.filter((row) => {
        const owner = equipmentOwner(row)
        return owner === null || commonMemberSet.has(String(owner))
      }),
      bound.input.memberIds,
      commonMemberIds,
    ),
  }
}

const invariantCache = new WeakMap<TeamSameCoreOutputEvidence, Map<string, string>>()

export function cachedCommonMemberInvariant(
  evidence: TeamSameCoreOutputEvidence,
  common: readonly string[],
) {
  const key = [...common].sort().join('|')
  let cache = invariantCache.get(evidence)
  if (!cache) {
    cache = new Map()
    invariantCache.set(evidence, cache)
  }
  let identity = cache.get(key)
  if (identity === undefined) {
    identity = stableContentHash(
      evidence.prepared.status === 'ready'
        ? commonMemberInvariant(evidence.prepared, [...common].sort())
        : evidence.prepared,
    )
    cache.set(key, identity)
  }
  return identity
}
