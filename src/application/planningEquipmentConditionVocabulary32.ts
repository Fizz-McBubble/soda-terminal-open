import {
  projectCurrentPlanningConditionCatalog32,
  currentPlanningConditionCatalogIdentity32,
  type PlanningConditionCatalogInput32,
  type PlanningConditionDef32,
  type PlanningConditionProjection32,
} from '../calculation/currentPlanningConditionCatalog32'
import { stableContentHash } from '../gameDataPacks/types'

/** Private, source-derived comparison domain. These are alternatives, never
 * simultaneous equipment, observed states or permissions to omit unknown effects. */
export type PlanningEquipmentConditionAlternatives32 = Array<{
  providerAgentId: string
  engineIds: string[]
  discProfiles: Array<Array<{ setId: string; pieces: number }>>
}>

const profileKey = (rows: readonly { setId: string; pieces: number }[]) =>
  stableContentHash([...rows].sort((a, b) => a.setId.localeCompare(b.setId)))
const cache = new Map<
  string,
  {
    definitions: Map<string, PlanningConditionDef32[]>
    gaps: string[]
    identity: string
  }
>()

export function planningEquipmentConditionVocabulary32(input: {
  memberIds: string[]
  equippedWEngines: NonNullable<PlanningConditionCatalogInput32['equippedWEngines']>
  equippedDriveDiscs: NonNullable<PlanningConditionCatalogInput32['equippedDriveDiscs']>
  projections: Map<string, PlanningConditionProjection32>
  alternatives?: PlanningEquipmentConditionAlternatives32
}) {
  const definitions = new Map<string, Map<string, PlanningConditionDef32>>()
  const gaps: string[] = []
  const merge = (owner: string, projection: PlanningConditionProjection32) => {
    gaps.push(...projection.blockers)
    const defs = definitions.get(owner) ?? new Map<string, PlanningConditionDef32>()
    for (const def of projection.defs) {
      const key = `${def.providerAgentId}:${def.referenceKey}`
      const existing = defs.get(key)
      if (existing && stableContentHash(existing) !== stableContentHash(def))
        gaps.push(`候选装备条件定义冲突：${owner}:${key}`)
      else defs.set(key, def)
    }
    definitions.set(owner, defs)
  }
  for (const [owner, projection] of input.projections) merge(owner, projection)
  if (!input.alternatives)
    return {
      definitions: new Map([...definitions].map(([id, defs]) => [id, [...defs.values()]])),
      gaps,
      identity: null,
    }
  if (
    input.alternatives.length !== input.memberIds.length ||
    new Set(input.alternatives.map((row) => row.providerAgentId)).size !== input.memberIds.length
  )
    gaps.push('候选装备条件域必须逐一对应当前三名成员。')
  for (const option of input.alternatives) {
    const engine = input.equippedWEngines.find(
      (row) => row.providerAgentId === option.providerAgentId,
    )
    const actualDiscs = input.equippedDriveDiscs
      .filter((row) => row.providerAgentId === option.providerAgentId)
      .map(({ setId, pieces }) => ({ setId, pieces }))
    if (
      !input.memberIds.includes(option.providerAgentId) ||
      !engine ||
      !option.engineIds.length ||
      new Set(option.engineIds).size !== option.engineIds.length ||
      !option.engineIds.includes(engine.engineId) ||
      !option.discProfiles.length ||
      option.discProfiles.some(
        (profile) =>
          new Set(profile.map((row) => row.setId)).size !== profile.length ||
          profile.some((row) => !Number.isInteger(row.pieces) || row.pieces < 1) ||
          profile.reduce((sum, row) => sum + row.pieces, 0) !== 6,
      ) ||
      !option.discProfiles.some((profile) => profileKey(profile) === profileKey(actualDiscs))
    ) {
      gaps.push(`当前装备不属于签发的候选条件域：${option.providerAgentId}`)
    }
  }
  // Membership is checked for every candidate. Only the immutable source
  // vocabulary is shared; stats, effects, declarations and numeric results are not.
  if (gaps.length)
    return {
      definitions: new Map([...definitions].map(([id, defs]) => [id, [...defs.values()]])),
      gaps,
      identity: null,
    }
  const cacheKey = stableContentHash({
    source: currentPlanningConditionCatalogIdentity32,
    memberIds: input.memberIds,
    alternatives: input.alternatives,
  })
  const saved = cache.get(cacheKey)
  if (saved) return structuredClone(saved)
  for (const option of input.alternatives) {
    const project = (
      equippedWEngines: typeof input.equippedWEngines,
      equippedDriveDiscs: typeof input.equippedDriveDiscs,
    ) => {
      for (const subjectAgentId of input.memberIds)
        merge(
          subjectAgentId,
          projectCurrentPlanningConditionCatalog32({
            subjectAgentId,
            memberIds: input.memberIds,
            equippedWEngines,
            equippedDriveDiscs,
          }),
        )
    }
    for (const engineId of option.engineIds)
      project(
        input.equippedWEngines.map((row) =>
          row.providerAgentId === option.providerAgentId ? { ...row, engineId } : row,
        ),
        input.equippedDriveDiscs,
      )
    for (const profile of option.discProfiles)
      project(input.equippedWEngines, [
        ...input.equippedDriveDiscs.filter((row) => row.providerAgentId !== option.providerAgentId),
        ...profile.map((row) => ({ ...row, providerAgentId: option.providerAgentId })),
      ])
  }
  const result = {
    identity: cacheKey,
    definitions: new Map(
      [...definitions].map(([id, defs]) => [
        id,
        [...defs.values()].sort((a, b) =>
          `${a.providerAgentId}:${a.referenceKey}`.localeCompare(
            `${b.providerAgentId}:${b.referenceKey}`,
          ),
        ),
      ]),
    ),
    gaps: [...new Set(gaps)],
  }
  if (!result.gaps.length) {
    cache.set(cacheKey, structuredClone(result))
    if (cache.size > 16) cache.delete(cache.keys().next().value!)
  }
  return result
}
