import type { AccountRoster, ObservedAgentField, RosterAgent } from '../assault/types'
import { assertBangbooSkillFacts, assertRosterAscensionFacts } from '../accounts/rosterHydration'
import { getObservedAgentFieldValue, hasObservedAgentField } from '../accounts/observedAgentFacts'
import type { AssetQuickReadCandidate } from './snapshotAdapter'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'

const currentEngineFields: ObservedAgentField[] = [
  'wEngineDetails.id',
  'wEngineDetails.name',
  'wEngineDetails.level',
  'wEngineDetails.ascension',
  'wEngineDetails.refinement',
]

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
  if (timestamp && !Number.isFinite(Date.parse(timestamp)))
    throw new Error('已保存的观察时间无效，请先核对来源时间，未写入账户。')
  // Dates can carry different UTC offsets, so lexical order is not chronological order.
  return Boolean(timestamp && Date.parse(timestamp) > Date.parse(capturedAt))
}

export function mergeAssetQuickReadRoster(
  current: AccountRoster,
  candidate: AssetQuickReadCandidate,
  sourceToId: Map<string, string>,
  manualUpdatedAt: string | undefined,
) {
  if (
    !Number.isFinite(Date.parse(candidate.capturedAt)) ||
    (manualUpdatedAt !== undefined && !Number.isFinite(Date.parse(manualUpdatedAt))) ||
    !Number.isFinite(Date.parse(current.updatedAt))
  )
    throw new Error('账户或快照时间无效，无法核对手动修改顺序，未写入账户。')
  let protectedFields = 0
  let syncedManualProgressionFields = 0
  const unequippedEngineAgents = new Set<string>()
  const incoming = new Map<string, (typeof candidate.agents)[number]>()
  const ambiguousCanonicalAgentIds = new Set<string>()
  for (const agent of candidate.agents) {
    const canonicalId = resolveCurrentReleasedIdentity(agent.agentId)
    if (incoming.has(canonicalId)) {
      ambiguousCanonicalAgentIds.add(canonicalId)
    } else {
      incoming.set(canonicalId, agent)
    }
  }
  if (ambiguousCanonicalAgentIds.size > 0)
    throw new Error('快照中存在指向同一代理人的多个别名记录，存在歧义未写入账户。')
  const existingIds = current.agents.map((agent) => resolveCurrentReleasedIdentity(agent.agentId))
  if (new Set(existingIds).size !== existingIds.length)
    throw new Error('账户中存在指向同一代理人的多个别名记录，请先核对，未写入账户。')
  const roster: AccountRoster = {
    ...current,
    agents: current.agents.map((existing) => {
      const canonicalExistingId = resolveCurrentReleasedIdentity(existing.agentId)
      const observation = incoming.get(canonicalExistingId)
      if (!observation) return existing
      const next = structuredClone(existing)
      let adopted = false
      const adoptedFields = new Set<ObservedAgentField>()
      for (const field of observation.observedFields) {
        const clearingEngine =
          field === 'wEngineDetails.id' && observation.fields.wEngineDetails?.id === null
        if (
          clearingEngine &&
          (currentEngineFields.some(
            (engineField) =>
              explicitlyLocked(existing, engineField) ||
              hasNewerObservation(existing, engineField, candidate.capturedAt),
          ) ||
            existing.lockedFields.includes('wEngineCopyId'))
        ) {
          // Removing the identity also removes its progression. Protect that
          // group together so a locked/newer subfield cannot become another item's fact.
          protectedFields++
          continue
        }
        const observedEngineId = observation.fields.wEngineDetails?.id
          ? resolveCurrentReleasedIdentity(observation.fields.wEngineDetails.id)
          : observation.fields.wEngineDetails?.id
        const currentEngineId = next.wEngineDetails?.id
          ? resolveCurrentReleasedIdentity(next.wEngineDetails.id)
          : next.wEngineDetails?.id
        if (
          field.startsWith('wEngineDetails.') &&
          field !== 'wEngineDetails.id' &&
          observedEngineId !== currentEngineId
        ) {
          protectedFields++
          continue
        }
        const value =
          field === 'equippedDiscIds'
            ? observation.equippedSourceIds.map((id) => sourceToId.get(id))
            : getObservedAgentFieldValue(observation.fields, field)
        const previousValue = getObservedAgentFieldValue(existing, field)
        const isSameEngine =
          field === 'wEngineDetails.id' &&
          typeof previousValue === 'string' &&
          typeof value === 'string' &&
          resolveCurrentReleasedIdentity(previousValue) === resolveCurrentReleasedIdentity(value)
        const differs =
          field === 'equippedDiscIds'
            ? JSON.stringify(previousValue) !== JSON.stringify(value)
            : field === 'wEngineDetails.id' && isSameEngine
              ? false
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
        if (clearingEngine) {
          const empty = observation.fields.wEngineDetails!
          if (
            empty.name !== null ||
            empty.level !== null ||
            empty.refinement !== null ||
            empty.ascension != null ||
            empty.manualProgression !== undefined
          )
            throw new Error('未装备音擎的观察状态不一致，未写入账户。')
          next.wEngineDetails = { id: null, name: null, level: null, refinement: null }
          next.wEngine = ''
          next.refinement = 0
          next.wEngineCopyId = null
          unequippedEngineAgents.add(next.agentId)
          unequippedEngineAgents.add(resolveCurrentReleasedIdentity(next.agentId))
          if (next.observedFacts)
            for (const engineField of currentEngineFields)
              delete next.observedFacts.fields[engineField]
        } else if (child) {
          if (parent === 'skillLevels') next.skillLevels = { ...next.skillLevels, [child]: value }
          else if (parent === 'wEngineDetails') {
            const nextChildValue =
              child === 'id' &&
              typeof next.wEngineDetails.id === 'string' &&
              typeof value === 'string' &&
              resolveCurrentReleasedIdentity(next.wEngineDetails.id) ===
                resolveCurrentReleasedIdentity(value) &&
              resolveCurrentReleasedIdentity(next.wEngineDetails.id) === next.wEngineDetails.id
                ? next.wEngineDetails.id
                : value
            next.wEngineDetails = { ...next.wEngineDetails, [child]: nextChildValue }
          } else throw new Error('资产快读字段不在可导入范围内。')
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
        const adoptedSkillFields = [...adoptedFields].filter((field) =>
          field.startsWith('skillLevels.'),
        )
        if (adoptedSkillFields.length === 6) {
          next.skills = '快读实测'
        } else if (adoptedSkillFields.length > 0) {
          next.skills = '快读部分实测'
        }
        if (adoptedFields.has('equippedDiscIds')) next.currentEquipment = 'known'
      }
      return next
    }),
    updatedAt:
      Date.parse(current.updatedAt) > Date.parse(candidate.capturedAt)
        ? current.updatedAt
        : candidate.capturedAt,
  }
  // Keep legacy inventory entities and their progression. Only their current
  // binding changes; leaving the inverse binding would re-equip them on hydration.
  if (roster.wEngines && unequippedEngineAgents.size)
    roster.wEngines = roster.wEngines.map((copy) =>
      copy.equippedAgentId &&
      (unequippedEngineAgents.has(copy.equippedAgentId) ||
        unequippedEngineAgents.has(resolveCurrentReleasedIdentity(copy.equippedAgentId)))
        ? { ...copy, equippedAgentId: null }
        : copy,
    )
  const physicalOwners = new Map<string, string>()
  for (const agent of roster.agents) {
    const canonicalAgentId = resolveCurrentReleasedIdentity(agent.agentId)
    for (const id of agent.equippedDiscIds ?? []) {
      const owner = physicalOwners.get(id)
      if (owner && owner !== canonicalAgentId)
        throw new Error('本次装备引用与保留的手动或旧装备记录冲突，请先核对该盘的装备归属。')
      physicalOwners.set(id, canonicalAgentId)
    }
  }
  assertBangbooSkillFacts(roster)
  assertRosterAscensionFacts(roster)
  return { roster, protectedFields, syncedManualProgressionFields }
}
