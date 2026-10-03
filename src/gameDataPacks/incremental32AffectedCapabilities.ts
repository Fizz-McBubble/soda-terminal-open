import { gameData32CatalogEntities } from './gameData32CatalogEntities'

/** Frozen 3.1 -> 3.2 source delta, not the global catalogue title.
 * These old sheets changed executable conditions and have not been certified
 * for the recovery variant. Unchanged old actors retain their normal gates. */
export const incremental32AffectedCapabilityIdentity = Object.freeze({
  previousCommit: 'eabba1f092b282cccb3f028b7253a1db3dac5208',
  currentCommit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  deltaSha256: 'e1625ddfe6c45e5157e01f258142bd68b9137cde1defa41b91a47c3dc4c48ce8',
  changedOldFormulaSubjects: ['agent-miyabi', 'agent-nekomata', 'agent-piper'],
  koledaChangedPotentialMinimum: 2,
})

const newIds = new Set(gameData32CatalogEntities.map((entity) => entity.id))
const newEngineIds = gameData32CatalogEntities
  .filter((entity) => entity.domain === 'wengine')
  .map((entity) => entity.id)

export function usesIncremental32Capabilities(input: {
  members: readonly { agentId: string; potential?: number | null }[]
  equipmentIds?: readonly string[]
  hasKoledaDeclaration?: boolean
  usesWindState?: boolean
  equipmentEffects?: readonly {
    effectKey: string
    sourceFormula?: { engineId: string }
  }[]
}) {
  if (
    input.usesWindState ||
    input.hasKoledaDeclaration ||
    input.equipmentIds?.some((id) => newIds.has(id)) ||
    input.equipmentEffects?.some((effect) =>
      effect.sourceFormula
        ? newIds.has(effect.sourceFormula.engineId)
        : newEngineIds.some((id) => effect.effectKey.startsWith(`wengine:${id}:`)),
    )
  )
    return true
  return input.members.some(
    (member) =>
      newIds.has(member.agentId) ||
      incremental32AffectedCapabilityIdentity.changedOldFormulaSubjects.includes(member.agentId) ||
      (member.agentId === 'agent-koleda' &&
        (member.potential ?? 0) >=
          incremental32AffectedCapabilityIdentity.koledaChangedPotentialMinimum),
  )
}
