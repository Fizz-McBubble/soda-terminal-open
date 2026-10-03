import type { WarehouseActionProjection } from './warehouseActionContract'
import {
  restoreWarehouseEvidenceText,
  warehouseEvidenceTextCodec,
} from './publicWarehouseEvidenceTextTransport'

const agentFields = [
  'compatibleAgentIds',
  'retentionAgentIds',
  'usageAgentIds',
  'affectedAgentIds',
] as const

type PackedAction = Record<string, unknown>
type PackedProjection = Omit<WarehouseActionProjection, 'actions'> & {
  agentLists: string[][]
  agentListsVersion: 1 | 2
  retentionTexts?: string[]
  actions: PackedAction[]
}

/** The same all-role compatibility lists occur on many discs. Intern them only on the wire. */
export function packPublicWarehouseActions(
  projection: WarehouseActionProjection,
): PackedProjection | WarehouseActionProjection {
  if (!Array.isArray(projection.actions)) return projection
  const textCodec = warehouseEvidenceTextCodec(
    projection.actions.map((item) => item.absoluteRetention),
  )
  const agentLists: string[][] = []
  const listIndexes = new Map<string, number>()
  const intern = (list: string[]) => {
    const key = JSON.stringify(list)
    const existing = listIndexes.get(key)
    if (existing !== undefined) return existing
    const index = agentLists.length
    agentLists.push(list)
    listIndexes.set(key, index)
    return index
  }
  const actions = projection.actions.map((item) => {
    const packed: PackedAction = { ...item }
    for (const field of agentFields) {
      const value = item[field]
      if (value) packed[field] = intern(value)
    }
    if (item.absoluteRetention) {
      packed.absoluteRetention = textCodec.encode({
        ...item.absoluteRetention,
        ownedUseAgentIds: intern(item.absoluteRetention.ownedUseAgentIds),
        unownedUseAgentIds: intern(item.absoluteRetention.unownedUseAgentIds),
      })
    }
    return packed
  })
  return {
    ...projection,
    agentListsVersion: 2,
    agentLists,
    retentionTexts: textCodec.texts,
    actions,
  }
}

/** Restore the page contract before any Warehouse consumer observes a remote result. */
export function unpackPublicWarehouseActions(
  projection: WarehouseActionProjection | PackedProjection,
): WarehouseActionProjection {
  if (!('agentListsVersion' in projection)) return projection
  if (![1, 2].includes(projection.agentListsVersion) || !Array.isArray(projection.agentLists))
    throw new Error('驱动盘分析结果格式无效，请重新分析。')
  if (
    projection.agentListsVersion === 2 &&
    (!Array.isArray(projection.retentionTexts) ||
      !projection.retentionTexts.every((text) => typeof text === 'string'))
  )
    throw new Error('驱动盘分析证据资料无效，请重新分析。')
  const readList = (index: unknown) => {
    const list =
      typeof index === 'number' && Number.isInteger(index) ? projection.agentLists[index] : null
    if (!Array.isArray(list) || !list.every((id) => typeof id === 'string'))
      throw new Error('驱动盘分析用途资料无效，请重新分析。')
    return [...list]
  }
  const actions = projection.actions.map((packed) => {
    const item = { ...packed } as PackedAction
    for (const field of agentFields) {
      if (item[field] !== undefined) item[field] = readList(item[field])
    }
    if (item.absoluteRetention) {
      const evidence = (
        projection.agentListsVersion === 2
          ? restoreWarehouseEvidenceText(item.absoluteRetention, projection.retentionTexts!)
          : item.absoluteRetention
      ) as Record<string, unknown>
      item.absoluteRetention = {
        ...evidence,
        ownedUseAgentIds: readList(evidence.ownedUseAgentIds),
        unownedUseAgentIds: readList(evidence.unownedUseAgentIds),
      }
    }
    return item
  })
  const restored = { ...projection, actions } as WarehouseActionProjection & {
    agentLists?: string[][]
    agentListsVersion?: 1 | 2
    retentionTexts?: string[]
  }
  delete restored.agentLists
  delete restored.agentListsVersion
  delete restored.retentionTexts
  return restored
}
