import type { AccountRoster, ObservedAgentField, RosterAgent } from '../assault/types'
import { assertBangbooSkillFacts, assertRosterAscensionFacts } from '../accounts/rosterHydration'
import { getObservedAgentFieldValue, hasObservedAgentField } from '../accounts/observedAgentFacts'
import type { AssetQuickReadCandidate } from './snapshotAdapter'

/** Merge only observed roster fields; transaction and account writes stay in accountImport. */
function isProgressionField(field: ObservedAgentField) {
  return (
    ['owned', 'level', 'ascension', 'mindscape', 'potentialImage'].includes(field) ||
    field.startsWith('skillLevels.')
  )
}

/** Current game equipment facts are independent of saved loadout/disc intentions. */
function automaticallySyncedField(field: ObservedAgentField) {
  return (
    isProgressionField(field) || field.startsWith('wEngineDetails.') || field === 'equippedDiscIds'
  )
}

function explicitlyLocked(agent: RosterAgent, field: ObservedAgentField) {
  return (
    agent.lockedFields.includes(field) ||
    agent.lockedFields.includes(field.split('.')[0]) ||
    (field.startsWith('skillLevels.') && agent.lockedFields.includes('skills')) ||
    (field.startsWith('wEngineDetails.') && agent.lockedFields.includes('wEngine'))
  )
}

function manuallyProtected(agent: RosterAgent, field: ObservedAgentField) {
  return (
    agent.manualSource === 'manual_override' ||
    (agent.progressionManuallySet === true && isProgressionField(field))
  )
}

function hasNewerObservation(agent: RosterAgent, field: ObservedAgentField, capturedAt: string) {
  const timestamp = agent.observedFacts?.fields[field]?.capturedAt
  // Dates can carry different UTC offsets, so lexical order is not chronological order.
  return Boolean(timestamp && Date.parse(timestamp) > Date.parse(capturedAt))
}

export function mergeAssetQuickReadRoster(
  current: AccountRoster,
  candidate: AssetQuickReadCandidate,
  sourceToId: Map<string, string>,
  manualUpdatedAt: string | undefined,
) {
  let protectedFields = 0
  let syncedManualProgressionFields = 0
  const incoming = new Map(candidate.agents.map((agent) => [agent.agentId, agent]))
  const roster: AccountRoster = {
    ...current,
    agents: current.agents.map((existing) => {
      const observation = incoming.get(existing.agentId)
      if (!observation) return existing
      const next = structuredClone(existing)
      let adopted = false
      const adoptedFields = new Set<ObservedAgentField>()
      for (const field of observation.observedFields) {
        if (
          field.startsWith('wEngineDetails.') &&
          field !== 'wEngineDetails.id' &&
          observation.fields.wEngineDetails?.id !== next.wEngineDetails.id
        ) {
          protectedFields++
          continue
        }
        const value =
          field === 'equippedDiscIds'
            ? observation.equippedSourceIds.map((id) => sourceToId.get(id))
            : getObservedAgentFieldValue(observation.fields, field)
        const previousValue = getObservedAgentFieldValue(existing, field)
        const differs =
          field === 'equippedDiscIds'
            ? JSON.stringify(previousValue) !== JSON.stringify(value)
            : previousValue !== value
        const hardProtected =
          explicitlyLocked(existing, field) ||
          hasNewerObservation(existing, field, candidate.capturedAt)
        const newerManualFact =
          automaticallySyncedField(field) &&
          manuallyProtected(existing, field) &&
          Boolean(manualUpdatedAt && Date.parse(manualUpdatedAt) > Date.parse(candidate.capturedAt))
        if (
          !hardProtected &&
          newerManualFact &&
          previousValue !== undefined &&
          previousValue !== null &&
          differs
        )
          throw new Error(
            '本次读取早于代理人养成或当前装备的后续手动修改，请重新读取，未写入账户。',
          )
        if (
          hardProtected ||
          newerManualFact ||
          (manuallyProtected(existing, field) && !automaticallySyncedField(field))
        ) {
          protectedFields++
          continue
        }
        if (field === 'equippedDiscIds' && (value as unknown[]).some((id) => !id))
          throw new Error('代理人装备盘无法对应到本次账户盘库，未导入。')
        const [parent, child] = field.split('.')
        if (child) {
          if (parent === 'skillLevels') next.skillLevels = { ...next.skillLevels, [child]: value }
          else if (parent === 'wEngineDetails')
            next.wEngineDetails = { ...next.wEngineDetails, [child]: value }
          else throw new Error('资产快读字段不在可导入范围内。')
        } else {
          Object.assign(next, { [parent]: value })
        }
        next.observedFacts ??= {
          schemaVersion: 1,
          source: 'asset_quick_read',
          protocolVersion: '3.2',
          fields: {},
        }
        // Identity provenance marks when this equipment became current. Re-reading the
        // same identity must not invalidate progression observed on that same item.
        if (!(field === 'wEngineDetails.id' && !differs && next.observedFacts.fields[field]))
          next.observedFacts.fields[field] = {
            capturedAt: candidate.capturedAt,
            snapshotSha256: candidate.snapshotSha256,
          }
        if (!hasObservedAgentField(next, field))
          throw new Error('资产快读代理人字段未通过值与来源检查，未导入。')
        adopted = true
        adoptedFields.add(field)
        if (field === 'wEngineDetails.id' && differs) delete next.wEngineDetails.manualProgression
        if (
          field !== 'owned' &&
          isProgressionField(field) &&
          manuallyProtected(existing, field) &&
          typeof previousValue === 'number' &&
          previousValue !== value
        )
          syncedManualProgressionFields++
      }
      if (adopted) {
        next.source = 'asset_quick_read'
        next.syncedAt = candidate.capturedAt
        next.completeness = 'partial'
        if (adoptedFields.has('wEngineDetails.name'))
          next.wEngine = next.wEngineDetails.name ?? next.wEngine
        if (adoptedFields.has('wEngineDetails.refinement'))
          next.refinement = next.wEngineDetails.refinement ?? next.refinement
        if ([...adoptedFields].some((field) => field.startsWith('skillLevels.')))
          next.skills = '快读实测'
        if (adoptedFields.has('equippedDiscIds')) next.currentEquipment = 'known'
      }
      return next
    }),
    updatedAt:
      Date.parse(current.updatedAt) > Date.parse(candidate.capturedAt)
        ? current.updatedAt
        : candidate.capturedAt,
  }
  const physicalOwners = new Map<string, string>()
  for (const agent of roster.agents) {
    for (const id of agent.equippedDiscIds ?? []) {
      const owner = physicalOwners.get(id)
      if (owner && owner !== agent.agentId)
        throw new Error('本次装备引用与保留的手动或旧装备记录冲突，请先核对该盘的装备归属。')
      physicalOwners.set(id, agent.agentId)
    }
  }
  assertBangbooSkillFacts(roster)
  assertRosterAscensionFacts(roster)
  return { roster, protectedFields, syncedManualProgressionFields }
}
