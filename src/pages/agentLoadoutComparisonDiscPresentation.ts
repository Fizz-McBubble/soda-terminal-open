import type { DriveDisc } from '../domain/schemas'
import type { DevelopmentCandidateAlternativesQueryResult } from '../application/calculationQueryContract'
import { getAgentName } from '../application/publicRosterNames'
import { presentDiscFactFromChoice } from './discFactPresentation'
import { displayDiscMainValue, displayDriveDiscSet } from './publicDiscFacts'

export function agentComparisonSetSummary(
  discs: readonly DriveDisc[],
  pattern?: '4+2' | '2+2+2' | 'scattered',
) {
  const counts = new Map<string, number>()
  for (const disc of discs) counts.set(disc.setId, (counts.get(disc.setId) ?? 0) + 1)
  const pieces = [...counts.entries()]
    .toSorted(([, left], [, right]) => right - left)
    .map(([setId, count]) => `${displayDriveDiscSet(setId)} ${count}件`)
  return pattern
    ? `${pattern === 'scattered' ? '散搭' : pattern}：${pieces.join(' + ')}`
    : pieces.join(' + ')
}

export function projectAgentLoadoutComparisonDiscs(input: {
  agentId: string
  baseline: readonly DriveDisc[]
  savedBaselineDiscs: readonly DriveDisc[]
  currentPlanDiscs: readonly DriveDisc[]
  alternatives: DevelopmentCandidateAlternativesQueryResult['candidates']
  conflicts: ReadonlyMap<string, string[]>
}) {
  const { agentId, baseline, savedBaselineDiscs, currentPlanDiscs, alternatives, conflicts } = input
  const allDiscIds = [
    ...new Set([
      ...baseline.map((disc) => disc.id),
      ...savedBaselineDiscs.map((disc) => disc.id),
      ...currentPlanDiscs.map((disc) => disc.id),
      ...alternatives.flatMap((plan) => plan.loadouts[0]?.discs.map((item) => item.disc.id) ?? []),
    ]),
  ]
  const snapshotDiscById = new Map(
    [
      ...baseline,
      ...savedBaselineDiscs,
      ...currentPlanDiscs,
      ...alternatives.flatMap((plan) => plan.loadouts[0]?.discs.map((item) => item.disc) ?? []),
    ].map((disc) => [disc.id, disc]),
  )
  const discs = allDiscIds.flatMap((id) => {
    const disc = snapshotDiscById.get(id)
    if (!disc) return []
    const set = displayDriveDiscSet(disc.setId)
    const choice =
      alternatives
        .flatMap((plan) => plan.loadouts[0]?.discs ?? [])
        .find((item) => item.disc.id === id) ?? null
    return [
      {
        ...presentDiscFactFromChoice({
          agentId,
          disc,
          choice,
          set,
          mainValue: displayDiscMainValue(disc),
        }),
        conflicts: (conflicts.get(id) ?? []).map((ownerId) => ({
          agentId: ownerId,
          name: getAgentName(ownerId),
        })),
      },
    ]
  })
  return discs
}
