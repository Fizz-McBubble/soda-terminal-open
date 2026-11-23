import type { RosterAgent } from '../assault/types'
import type { DriveDisc } from '../domain/schemas'

export type DevelopmentDirectoryDiscIndex = ReadonlyMap<
  string,
  readonly Pick<DriveDisc, 'id' | 'slot'>[]
>

export function createDevelopmentDirectoryDiscIndex(
  discs: readonly Pick<DriveDisc, 'id' | 'slot'>[] | undefined,
): DevelopmentDirectoryDiscIndex | undefined {
  if (!discs) return undefined
  const index = new Map<string, Array<Pick<DriveDisc, 'id' | 'slot'>>>()
  for (const disc of discs) {
    const matches = index.get(disc.id)
    if (matches) matches.push(disc)
    else index.set(disc.id, [disc])
  }
  return index
}

export function projectDevelopmentDirectoryEquipmentProgress(
  agent: Pick<RosterAgent, 'wEngineDetails' | 'equippedDiscIds'>,
  discIndex: DevelopmentDirectoryDiscIndex | undefined,
) {
  const engine = agent.wEngineDetails?.id || agent.wEngineDetails?.name ? '已记录' : '待确认'
  const ids = agent.equippedDiscIds
  if (!ids || !discIndex) return { engine, discs: '装备记录待确认' }
  const matches = [...new Set(ids)].flatMap((id) => discIndex.get(id) ?? [])
  const slots = new Set(matches.map((disc) => disc.slot).filter((slot) => slot >= 1 && slot <= 6))
  if (matches.length !== ids.length || slots.size !== ids.length)
    return { engine, discs: `已确认 ${slots.size}/6，部分记录待核对` }
  return { engine, discs: `已装备 ${slots.size}/6` }
}

/** Describe recorded equipment only; unknown references are not empty slots. */
export function projectDirectoryEquipmentProgress(
  agent: Pick<RosterAgent, 'wEngineDetails' | 'equippedDiscIds'>,
  discs: readonly Pick<DriveDisc, 'id' | 'slot'>[] | undefined,
) {
  return projectDevelopmentDirectoryEquipmentProgress(
    agent,
    createDevelopmentDirectoryDiscIndex(discs),
  )
}
