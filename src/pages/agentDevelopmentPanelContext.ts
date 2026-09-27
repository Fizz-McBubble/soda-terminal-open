import type { DriveDisc } from '../domain/schemas'
import type { createAgentDevelopmentPanelProjection } from './agentDevelopmentPanelProjection'

export function createDevelopmentPanelContext({
  panelProjection,
  hasComparablePlan,
  candidateChoices,
  savedAgentBuild,
  currentDiscIds,
  data,
  coreLevel,
}: {
  panelProjection: ReturnType<typeof createAgentDevelopmentPanelProjection>
  hasComparablePlan: boolean
  candidateChoices: readonly { disc: { id: string } }[]
  savedAgentBuild?: { warehouseRefs: string[] } | null
  currentDiscIds: readonly string[]
  data: { discs: DriveDisc[] }
  coreLevel?: number | null
}) {
  return panelProjection.result.status === 'ok'
    ? {
        coreLevel: coreLevel ?? undefined,
        values: panelProjection.result.values,
        baseValues: panelProjection.result.trace
          .filter((entry) => entry.operation === 'base')
          .reduce<Record<string, number>>((values, entry) => {
            if (typeof entry.value === 'number')
              values[entry.key] = (values[entry.key] ?? 0) + entry.value
            return values
          }, {}),
        currentSetIds: (() => {
          const selectedIds = hasComparablePlan
            ? candidateChoices.map((choice) => choice.disc.id)
            : (savedAgentBuild?.warehouseRefs ?? currentDiscIds)
          const counts = new Map<string, number>()
          data.discs
            .filter((disc) => selectedIds.includes(disc.id))
            .forEach((disc) => counts.set(disc.setId, (counts.get(disc.setId) ?? 0) + 1))
          return [...counts.entries()].filter(([, count]) => count >= 2).map(([setId]) => setId)
        })(),
      }
    : undefined
}
