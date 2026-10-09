import { resolveCurrentAgentResourceEvent32 } from './currentAgentMechanicContracts'
import { currentAgentResourceEventIdentity32 } from './currentAgentResourceEvents32'
import { stableContentHash } from '../gameDataPacks/types'
import { isSourceRateEvent32 } from './sourceEventQuantity32'
import type { PlanningEventUsage } from './planningCalculationContextCompiler'

/** Declared source-row production, separate from natural regeneration, grants,
 * resource spending and point conversion. Never priced as damage or efficiency. */
export function summarizeSourceResourceProduction32(input: {
  agentId: string
  eventUsages: readonly PlanningEventUsage[]
  mechanismGrants32?: ReturnType<
    typeof import('./sourceMechanismResourceGrants32').summarizeSourceMechanismResourceGrants32
  >
}) {
  const rows = input.eventUsages.filter((row) => row.ownerAgentId === input.agentId)
  const blockers: string[] = []
  let energy = 0,
    decibels = 0
  let energyUnknown = false,
    decibelsUnknown = false
  const events = rows.map((row) => {
    const source = resolveCurrentAgentResourceEvent32({
      stableId: input.agentId,
      eventId: row.eventId,
      skillLevel: row.skillLevel,
    })
    const validCount = Number.isInteger(row.occurrenceCount) && row.occurrenceCount > 0
    if (source.status !== 'supported' || !validCount) {
      energyUnknown = decibelsUnknown = true
      blockers.push(
        ...(source.status !== 'supported' ? source.blockers : ['invalid_resource_event_count']),
      )
      return { eventId: row.eventId, energy: null, decibels: null, sourceRefs: row.evidenceRefs }
    }
    // A per-second DAMAGE row does not prove that its resource columns use
    // seconds. Zero columns are exact; nonzero columns need their own count.
    if (
      isSourceRateEvent32(row.ownerAgentId, row.eventId) &&
      (source.energy.value !== 0 || source.decibels.value !== 0)
    ) {
      blockers.push('resource_rate_row_quantity_unverified')
      energyUnknown ||= source.energy.value !== 0
      decibelsUnknown ||= source.decibels.value !== 0
      return {
        eventId: row.eventId,
        energy: source.energy.value === 0 ? 0 : null,
        decibels: source.decibels.value === 0 ? 0 : null,
        sourceRefs: source.sourceRefs,
      }
    }
    const producedEnergy = source.energy.value * row.occurrenceCount
    const producedDecibels = source.decibels.value * row.occurrenceCount
    if (![producedEnergy, producedDecibels].every(Number.isFinite)) {
      blockers.push('nonfinite_source_resource_total')
      energyUnknown ||= !Number.isFinite(producedEnergy)
      decibelsUnknown ||= !Number.isFinite(producedDecibels)
    }
    energy += producedEnergy
    decibels += producedDecibels
    return {
      eventId: row.eventId,
      energy: producedEnergy,
      decibels: producedDecibels,
      sourceRefs: source.sourceRefs,
    }
  })
  if (!rows.length) {
    blockers.push('resource_event_declaration_missing')
    energyUnknown = decibelsUnknown = true
  }
  energyUnknown ||= !Number.isFinite(energy)
  decibelsUnknown ||= !Number.isFinite(decibels)
  const core = {
    sourceStatus: blockers.length ? ('unknown' as const) : ('supported' as const),
    agentId: input.agentId,
    events,
    energy: { value: energyUnknown ? null : energy, unit: 'upstream_SpRecovery' as const },
    decibels: { value: decibelsUnknown ? null : decibels, unit: 'upstream_FeverRecovery' as const },
    gamePoints: { energy: null, decibels: null },
    teammateDecibelDistribution: 'unverified' as const,
    ...(input.mechanismGrants32 ? { mechanismGrants32: input.mechanismGrants32 } : {}),
    blockers: [...new Set(blockers)],
    sourceIdentity: currentAgentResourceEventIdentity32,
    boundary:
      'Declared source-row production only; point conversion, receipt, elapsed time, overflow and spending are separate.',
  }
  return { ...core, fingerprint: stableContentHash(core) }
}
