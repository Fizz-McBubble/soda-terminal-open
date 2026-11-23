import type { DriveDisc } from '../domain/schemas'
import { resolveCurrentDriveDiscTwoPieceModifiers } from '../gameDataPacks/currentDriveDiscFormulaCatalog'

export type NormalizedPercentageStat = 'hp' | 'atk' | 'def' | 'impact' | 'anomMas' | 'enerRegen'

export const elementalDamageTwoPieceStats = new Set([
  'physical_dmg_',
  'fire_dmg_',
  'ice_dmg_',
  'electric_dmg_',
  'wind_dmg_',
  'ether_dmg_',
])

export function emptyNormalizedPercentages(): Record<NormalizedPercentageStat, number> {
  return { hp: 0, atk: 0, def: 0, impact: 0, anomMas: 0, enerRegen: 0 }
}

export function addStaticTwoPieceModifiers(input: {
  discs: readonly DriveDisc[]
  attribute: string
  percentages: Record<NormalizedPercentageStat, number>
  add: {
    critRate: (value: number) => void
    critDamage: (value: number) => void
    anomalyProficiency: (value: number) => void
    penetrationRatio: (value: number) => void
  }
  damageBonus: { value: number }
  damageBonusesByAttribute?: Record<string, number>
  actionDamageBonuses: Array<{ actionTypes: readonly string[]; value: number }>
}) {
  const setCounts = new Map<string, number>()
  input.discs.forEach((disc) => setCounts.set(disc.setId, (setCounts.get(disc.setId) ?? 0) + 1))
  const appliedSetIds: string[] = []
  const excludedSetIds: string[] = []
  const excludedModifiers: Array<{ setId: string; stat: string }> = []
  const unresolvedModifiers: Array<{ setId: string; stat: string }> = []
  for (const [setId, count] of setCounts) {
    if (count < 2) continue
    const modifiers = resolveCurrentDriveDiscTwoPieceModifiers(setId, count)
    if (!modifiers.length) {
      excludedSetIds.push(setId)
      const missing = { setId, stat: 'missing_two_piece_source' }
      excludedModifiers.push(missing)
      unresolvedModifiers.push(missing)
      continue
    }
    const unsupported = modifiers.filter((modifier) => {
      if (
        [
          'hp_',
          'atk_',
          'def_',
          'impact_',
          'anomMas_',
          'enerRegen_',
          'crit_',
          'crit_dmg_',
          'anomProf',
          'pen_',
        ].includes(modifier.stat)
      )
        return false
      if (elementalDamageTwoPieceStats.has(modifier.stat)) return false
      if (modifier.stat === 'action_dmg_') return !modifier.actionTypes?.length
      return !['shield_', 'dazeInc_'].includes(modifier.stat)
    })
    if (unsupported.length) {
      excludedSetIds.push(setId)
      unsupported.forEach((modifier) => {
        const unresolved = { setId, stat: modifier.stat }
        excludedModifiers.push(unresolved)
        unresolvedModifiers.push(unresolved)
      })
      continue
    }
    for (const modifier of modifiers) {
      if (modifier.stat === 'hp_') input.percentages.hp += modifier.value
      if (modifier.stat === 'atk_') input.percentages.atk += modifier.value
      if (modifier.stat === 'def_') input.percentages.def += modifier.value
      if (modifier.stat === 'impact_') input.percentages.impact += modifier.value
      if (modifier.stat === 'anomMas_') input.percentages.anomMas += modifier.value
      if (modifier.stat === 'enerRegen_') input.percentages.enerRegen += modifier.value
      if (modifier.stat === 'crit_') input.add.critRate(modifier.value)
      if (modifier.stat === 'crit_dmg_') input.add.critDamage(modifier.value)
      if (modifier.stat === 'anomProf') input.add.anomalyProficiency(modifier.value)
      if (modifier.stat === 'pen_') input.add.penetrationRatio(modifier.value)
      if (modifier.stat === `${input.attribute}_dmg_`) input.damageBonus.value += modifier.value
      if (elementalDamageTwoPieceStats.has(modifier.stat) && input.damageBonusesByAttribute) {
        const attribute = modifier.stat.slice(0, -5)
        input.damageBonusesByAttribute[attribute] += modifier.value
      }
      if (modifier.stat === 'action_dmg_')
        input.actionDamageBonuses.push({
          actionTypes: modifier.actionTypes!,
          value: modifier.value,
        })
      if (['shield_', 'dazeInc_'].includes(modifier.stat))
        excludedModifiers.push({ setId, stat: modifier.stat })
    }
    appliedSetIds.push(setId)
  }
  return {
    status: unresolvedModifiers.length ? ('partial' as const) : ('complete' as const),
    appliedSetIds: appliedSetIds.sort(),
    excludedSetIds: excludedSetIds.sort(),
    excludedModifiers: excludedModifiers.sort((left, right) =>
      `${left.setId}:${left.stat}`.localeCompare(`${right.setId}:${right.stat}`),
    ),
    unresolvedModifiers: unresolvedModifiers.sort((left, right) =>
      `${left.setId}:${left.stat}`.localeCompare(`${right.setId}:${right.stat}`),
    ),
  }
}
