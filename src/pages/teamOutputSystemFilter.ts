import {
  teamPrimaryOutputKindLabels,
  type TeamPrimaryOutputKind,
} from '../domain/teamOutputKindPresentation'
import { teamOutputModuleLabel } from './teamOutputModulePresentation'
import type { TeamLoadoutOverviewFamily, TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'
import { orderVisibleFamilies, rebuildVisibleFamily } from './teamVisibleFamilyPresentation'
import { visibleGraduatedScore } from './teamRatingPresentation'

export type TeamOutputSystemFilter = 'all' | TeamPrimaryOutputKind | 'unclassified'

export type TeamOutputSystemOption = {
  value: TeamOutputSystemFilter
  label: string
  count: number
}

const orderedSystems: readonly TeamPrimaryOutputKind[] = [
  'direct_damage',
  'attribute_anomaly',
  'rupture',
  'aftershock',
  'sharp',
]

function classifiedModuleSystem(item: TeamLoadoutOverviewItem) {
  return item.outputModule?.status === 'classified'
    ? item.outputModule.module.primaryOutputKind
    : null
}

function currentReviewedModuleSystem(item: TeamLoadoutOverviewItem) {
  const module = item.outputModule
  return module?.status === 'classified' &&
    (module.classification === 'current_exact_team_review' ||
      module.classification === 'current_aggregate_exact_team_observation')
    ? module.module.primaryOutputKind
    : null
}

function systemForItem(item: TeamLoadoutOverviewItem): Exclude<TeamOutputSystemFilter, 'all'> {
  // A reviewed trio can support several plays. The score displayed on this row
  // belongs to one exact play, which also determines its filter and label.
  const ranking = item.teamSystemRanking
  if (ranking?.status === 'ranked' && visibleGraduatedScore(item)) return ranking.system
  const reviewed = currentReviewedModuleSystem(item)
  if (reviewed) return reviewed
  if (ranking?.status === 'ranked') return ranking.system
  return classifiedModuleSystem(item) ?? 'unclassified'
}

function labelForSystem(system: Exclude<TeamOutputSystemFilter, 'all'>) {
  return system === 'unclassified' ? '未分类' : teamPrimaryOutputKindLabels[system]
}

export function normalizeTeamOutputSystemFilter(
  value: string | null | undefined,
): TeamOutputSystemFilter {
  return value === 'all' || orderedSystems.includes(value as TeamPrimaryOutputKind)
    ? (value as TeamOutputSystemFilter)
    : 'all'
}

export function teamOutputSystemLabel(item: TeamLoadoutOverviewItem) {
  const system = systemForItem(item)
  return item.outputModule?.status === 'classified' && item.outputModule.module.primaryOutputKind === system
    ? teamOutputModuleLabel(item.outputModule.module)
    : labelForSystem(system)
}

/** Filtering and headings use the same classification for each visible play. */
export function filterTeamFamiliesByOutputSystem(
  families: readonly TeamLoadoutOverviewFamily[],
  filter: TeamOutputSystemFilter,
) {
  if (filter === 'all') return families
  const filtered = families.flatMap((family) => {
    const variants = family.variants.filter((item) => systemForItem(item) === filter)
    if (!variants.length) return []
    return [
      variants.length === family.variants.length ? family : rebuildVisibleFamily(family, variants),
    ]
  })
  return orderVisibleFamilies(filtered)
}

export function teamOutputSystemOptionsForFamilies(
  families: readonly TeamLoadoutOverviewFamily[],
): TeamOutputSystemOption[] {
  const matchingFamilies = (filter: Exclude<TeamOutputSystemFilter, 'all'>) =>
    families.filter((family) => family.variants.some((item) => systemForItem(item) === filter))
      .length
  const unclassifiedCount = matchingFamilies('unclassified')
  return [
    { value: 'all', label: '全部体系', count: families.length },
    ...orderedSystems.map((system) => ({
      value: system,
      label: labelForSystem(system),
      count: matchingFamilies(system),
    })),
    ...(unclassifiedCount > 0
      ? [{ value: 'unclassified' as const, label: labelForSystem('unclassified'), count: unclassifiedCount }]
      : []),
  ]
}
