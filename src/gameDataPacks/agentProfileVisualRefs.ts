import { bangbooCatalog } from '../assault/catalog'
import wEngineCatalog from '../assault/data/wEngineCatalog.3.0.json'
import { driveDiscData } from '../data/gameData'
import { getVisualAsset, type VisualAssetEntityType } from '../assets/visualAssets'
import { getCandidateWarehouseConstraint } from './candidateWarehouseConstraints'
import type { AgentProfileVisualRef } from './agentProfileFieldProjection'
function visualRef(
  entityType: VisualAssetEntityType,
  entityId: string,
  name: string,
): AgentProfileVisualRef {
  const asset = getVisualAsset(
    entityType,
    entityId,
    entityType === 'agent' ? 'full_body' : undefined,
  )
  return {
    entityType,
    entityId,
    variant: asset?.variant ?? 'default',
    status:
      asset?.status === 'verified' &&
      asset.sourceType === 'official' &&
      asset.cachePolicy === 'explicit-personal-cache'
        ? 'verified'
        : 'missing',
    alt: `${name}图鉴图像`,
    sourcePage: asset?.sourcePage ?? null,
    sourceVersion: asset ? '3.0' : null,
    verifiedAt: asset?.verifiedAt ?? null,
    contentHash: asset?.contentHash ?? null,
    cachePolicy: asset?.cachePolicy ?? null,
  }
}

export function visualRefsFor(agentId: string, agentName: string): AgentProfileVisualRef[] {
  const constraint = getCandidateWarehouseConstraint(agentId)
  const engineNames = constraint?.wEngineDirections ?? []
  const teamText = constraint?.teamAndBangbooPreconditions.join('；') ?? ''
  const refs = [visualRef('agent', agentId, agentName)]
  for (const setId of constraint?.setIds ?? []) {
    const setName =
      driveDiscData?.driveDiscSets.find((set) => set.id === setId)?.name ?? '驱动盘套装'
    refs.push(visualRef('drive_disc_set', setId, setName))
  }
  for (const engine of wEngineCatalog.items) {
    if (
      engineNames.some(
        (name) =>
          name.includes(engine.name) || engine.name.includes(name) || name.includes(engine.id),
      )
    ) {
      refs.push(visualRef('wengine', engine.id, engine.name))
    }
  }
  for (const [bangbooId, bangbooName] of bangbooCatalog) {
    if (teamText.includes(bangbooName) || teamText.includes(bangbooId)) {
      refs.push(visualRef('bangboo', bangbooId, bangbooName))
    }
  }
  return refs.filter(
    (item, index, all) =>
      all.findIndex(
        (other) =>
          `${other.entityType}:${other.entityId}` === `${item.entityType}:${item.entityId}`,
      ) === index,
  )
}
