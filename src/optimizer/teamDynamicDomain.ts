import type { AgentDiscProfile } from '../assault/engine'
import type { DriveDisc } from '../domain/schemas'
import { currentDriveDiscFormulaCatalog } from '../gameDataPacks/currentDriveDiscFormulaCatalog'
import { getCurrentScopeEntry } from '../gameDataPacks/currentScopeManifest'
import {
  absoluteDiscRetentionCatalog,
  toAbsoluteRetentionDisc,
} from '../warehouse/absoluteDiscRetentionCatalog'
import { history } from '../warehouse/absoluteDiscRetentionScoring'
import { toBuildProfile, toCandidate } from './accountBuildCandidates'
import { scoreActualDisc, scoreSetFit } from './scoreActualDisc'
import {
  getCandidatePanelObjectiveTarget,
  projectCandidatePanelObjective,
} from './candidatePanelObjective'
import type { CandidatePanelInput, OptimizedBuild } from './optimizeBuild'

/** Reuse game-record validation, independently of retention quality/cleanup decisions. */
export function dynamicLegalInventory(discs: readonly DriveDisc[]) {
  const counts = new Map<string, number>()
  for (const disc of discs) counts.set(disc.id, (counts.get(disc.id) ?? 0) + 1)
  // The legacy driveDiscData only contains the old formal projection. Current
  // adopted candidate identities (for example Thorned Rose) are equally real
  // inventory: release/ownership come from scope, formulas from the current catalog.
  const knownSets = new Set(
    currentDriveDiscFormulaCatalog.items
      .filter((set) => {
        const scope = getCurrentScopeEntry(set.stableId)
        return (
          scope?.domain === 'drive_disc_set' &&
          scope.releaseState === 'released' &&
          scope.accountOwnable
        )
      })
      .map((set) => set.stableId),
  )
  return discs.filter((disc) => {
    if (counts.get(disc.id) !== 1 || !knownSets.has(disc.setId)) return false
    try {
      history(toAbsoluteRetentionDisc(disc), absoluteDiscRetentionCatalog.rules)
      return true
    } catch {
      return false
    }
  })
}

/** Compile the exact six physical records, including 4+1+1 and scattered inventory.
 * Source score is descriptive only: the complete team objective accepts changes. */
export function compileDynamicCandidateLoadout(
  selection: DriveDisc[],
  profile: AgentDiscProfile,
  panelInput?: CandidatePanelInput,
) {
  if (
    selection.length !== 6 ||
    new Set(selection.map((disc) => disc.id)).size !== 6 ||
    new Set(selection.map((disc) => disc.slot)).size !== 6
  )
    return null
  if (dynamicLegalInventory(selection).length !== 6) return null
  const sourceProfile = toBuildProfile(profile)
  const discs = selection.map((disc) => scoreActualDisc(disc, sourceProfile))
  const setCounts: Record<string, number> = {}
  for (const disc of selection) setCounts[disc.setId] = (setCounts[disc.setId] ?? 0) + 1
  const counts = Object.values(setCounts).sort((a, b) => b - a)
  const setPattern =
    counts[0] === 4 && counts[1] === 2
      ? '4+2'
      : counts.length === 3 && counts.every((count) => count === 2)
        ? '2+2+2'
        : 'scattered'
  const setScore = Object.entries(setCounts).reduce(
    (sum, [setId, count]) =>
      sum + (count >= 2 ? scoreSetFit(profile.setFit[setId] ?? 0, count) : 0),
    0,
  )
  const target = getCandidatePanelObjectiveTarget(profile.agentId, panelInput)
  // Required source functionality remains protected across changes of set branch.
  const panelObjective =
    target && panelInput ? projectCandidatePanelObjective(target, panelInput, selection) : undefined
  const discScore = discs.reduce((sum, disc) => sum + disc.score, 0)
  const build: OptimizedBuild = {
    rank: 1,
    discs,
    totalScore: discScore + setScore,
    discScore,
    setScore,
    effectiveRolls: discs.reduce((sum, disc) => sum + disc.effectiveRolls, 0),
    setCounts,
    setPattern,
    tieBreakKey: JSON.stringify(
      selection
        .toSorted((left, right) => left.slot - right.slot)
        .map((disc) => [disc.slot, disc.id]),
    ),
    ...(panelObjective ? { panelObjective, panelObjectiveStatus: 'applied' as const } : {}),
  }
  return toCandidate(build, profile, false, [])
}
