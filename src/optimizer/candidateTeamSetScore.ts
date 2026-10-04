import { sharedDiscProtectionSources } from '../calculation/currentDriveDiscPlanningEffects'
import { getCurrentDriveDiscFormulaData } from '../gameDataPacks/currentDriveDiscFormulaCatalog'
import { candidateSetFitPoints } from './scoreActualDisc'
import type { AccountLoadout } from './optimizeAccountBuilds'

/** Candidate warehouse profiles give each sourced set fit=1. Retain every wearer's
 * two-piece and actual stat score, but count a shared four-piece premium once.
 * This is the existing matching score, not measured uptime or damage. Never use
 * it across separate teams or for wearer-specific triggers such as Swing Jazz. */
export function candidateTeamSetScore(loadouts: readonly AccountLoadout[]) {
  let score = loadouts.reduce((sum, loadout) => sum + loadout.totalScore, 0)
  const applied = new Set<string>()
  for (const loadout of loadouts) {
    for (const [setId, count] of Object.entries(loadout.setCounts)) {
      if (count < 4) continue
      const source = sharedDiscProtectionSources[setId as keyof typeof sharedDiscProtectionSources]
      if (
        !source ||
        getCurrentDriveDiscFormulaData(setId)?.fourPieceFormula.sha256 !== source.formulaSha256
      )
        continue
      if (applied.has(setId))
        score -= candidateSetFitPoints.fourPiece - candidateSetFitPoints.twoPiece
      applied.add(setId)
    }
  }
  return score
}
