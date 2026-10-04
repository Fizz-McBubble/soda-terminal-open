import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { getCurrentDriveDiscFormulaData } from '../gameDataPacks/currentDriveDiscFormulaCatalog'
import { candidateNonStackingFourPieceIdentity } from './candidateNonStackingFourPiece'
import { candidateSetFitPoints } from './scoreActualDisc'
import type { AccountLoadout } from './optimizeAccountBuilds'

export type CandidateTeamSetScoreLoadout = Pick<
  AccountLoadout,
  'agentId' | 'setCounts' | 'totalScore'
>

/** Candidate warehouse profiles give each sourced set fit=1. Retain every wearer's
 * two-piece and actual stat score, but count a same-name four-piece premium once
 * among qualified wearers. A statically ineligible wearer receives no premium.
 * This is the existing matching score, not measured uptime or damage. Never use
 * it across separate teams or extrapolate it to unreviewed sets such as Swing Jazz. */
export function candidateTeamSetScore(loadouts: readonly CandidateTeamSetScoreLoadout[]) {
  let score = loadouts.reduce((sum, loadout) => sum + loadout.totalScore, 0)
  const applied = new Set<string>()
  for (const loadout of loadouts) {
    for (const [setId, count] of Object.entries(loadout.setCounts)) {
      if (count < 4) continue
      const source =
        candidateNonStackingFourPieceIdentity.sources[
          setId as keyof typeof candidateNonStackingFourPieceIdentity.sources
        ]
      if (
        !source ||
        getCurrentDriveDiscFormulaData(setId)?.fourPieceFormula.sha256 !== source.formulaSha256
      )
        continue
      const qualified =
        source.requiredSpecialty === null ||
        getCurrentAgentEventContract(loadout.agentId)?.identity.specialty ===
          source.requiredSpecialty
      if (!qualified || applied.has(setId))
        score -= candidateSetFitPoints.fourPiece - candidateSetFitPoints.twoPiece
      if (qualified) applied.add(setId)
    }
  }
  return score
}
