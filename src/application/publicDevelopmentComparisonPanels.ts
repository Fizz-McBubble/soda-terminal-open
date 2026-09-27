import type { DriveDisc } from '../domain/schemas'
import { contentHash } from './contentHash'

export const developmentComparisonPanelsContract = 'soda-development-comparison-panels/v1' as const

export const developmentPanelKeys = [
  'hp',
  'atk',
  'def',
  'impact',
  'critRate',
  'critDamage',
  'anomalyMastery',
  'anomalyProficiency',
  'pen',
  'penRatio',
  'energyRegen',
] as const

export type DevelopmentComparisonPanel = {
  discFingerprint: string
  status: 'ok' | 'unsupported'
  values: Record<(typeof developmentPanelKeys)[number], number>
  reason?: string
}

export type DevelopmentComparisonPanels = {
  contract: typeof developmentComparisonPanelsContract
  agentId: string
  entries: DevelopmentComparisonPanel[]
  targetDisplayByLabel: Record<string, string>
  saveKnowledge: {
    scenario: string
    profileId: string
    status: 'formal' | 'candidate' | 'missing'
    version: string
    source: string
    currentEngineRecorded: boolean
  }
}

/** Bind the read-only panel to all disc facts, not just IDs, across cache and account changes. */
export function developmentPanelDiscFingerprint(discs: DriveDisc[]) {
  return contentHash(
    discs
      .toSorted((a, b) => a.slot - b.slot || a.id.localeCompare(b.id))
      .map((disc) => ({
        id: disc.id,
        setId: disc.setId,
        slot: disc.slot,
        level: disc.level,
        rarity: disc.rarity,
        mainStat: disc.mainStat,
        subStats: disc.subStats,
        locked: disc.locked,
        favorite: disc.favorite,
        tags: disc.tags,
        discVersion: disc.discVersion,
        importBatchId: disc.importBatchId,
        importFingerprint: disc.importFingerprint,
        importSource: disc.importSource,
        evaluationSnapshot: disc.evaluationSnapshot,
        previousEvaluationSnapshot: disc.previousEvaluationSnapshot,
        createdAt: disc.createdAt,
        updatedAt: disc.updatedAt,
        dataVersion: disc.dataVersion,
      })),
  )
}

export function hasDevelopmentComparisonPanels(
  value: DevelopmentComparisonPanels | undefined,
  agentId: string,
): value is DevelopmentComparisonPanels {
  return Boolean(
    value?.contract === developmentComparisonPanelsContract &&
    value.agentId === agentId &&
    Array.isArray(value.entries) &&
    value.targetDisplayByLabel != null &&
    typeof value.targetDisplayByLabel === 'object' &&
    !Array.isArray(value.targetDisplayByLabel) &&
    Object.values(value.targetDisplayByLabel).every((target) => typeof target === 'string') &&
    typeof value.saveKnowledge?.scenario === 'string' &&
    typeof value.saveKnowledge.profileId === 'string' &&
    ['formal', 'candidate', 'missing'].includes(value.saveKnowledge.status) &&
    typeof value.saveKnowledge.version === 'string' &&
    typeof value.saveKnowledge.source === 'string' &&
    typeof value.saveKnowledge.currentEngineRecorded === 'boolean' &&
    value.entries.every(
      (entry) =>
        typeof entry.discFingerprint === 'string' &&
        (entry.status === 'ok' || entry.status === 'unsupported') &&
        (entry.reason === undefined || typeof entry.reason === 'string') &&
        developmentPanelKeys.every((key) => Number.isFinite(entry.values?.[key])),
    ),
  )
}

export function findDevelopmentComparisonPanel(
  presentation: DevelopmentComparisonPanels | undefined,
  discs: DriveDisc[],
) {
  return (
    presentation?.entries.find(
      (entry) => entry.discFingerprint === developmentPanelDiscFingerprint(discs),
    ) ?? null
  )
}
