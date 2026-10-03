import { currentAgentMechanicIdentity } from '../calculation/currentAgentMechanicContracts'
import currentAgentDecisionCatalog from './generated/current-agent-decision-mechanic-catalog.v1.json'
import { currentDriveDiscFormulaCatalog } from './currentDriveDiscFormulaCatalog'
import { currentWEngineStaticCatalog } from './currentWEngineStaticCatalog'
import { currentFormulaBaseStats, currentFormulaBaseStatsSource } from './currentFormulaBaseStats'
import { currentVersionProjection } from './currentVersionProjection'
import { stableContentHash } from './types'

// An engineering candidate source binding is separate from the installed release
// and from tuple-level Formal approval. It never upgrades historical field reviews.
const sourceBinding = {
  upstreamCommit: currentFormulaBaseStatsSource.upstreamCommit,
  agentMechanics: currentAgentMechanicIdentity,
  agentDecisionHash: currentAgentDecisionCatalog.contentHash,
  wEngineHash: currentWEngineStaticCatalog.contentHash,
  driveDiscHash: currentDriveDiscFormulaCatalog.contentHash,
  baseStats: currentFormulaBaseStats,
  baseStatsSource: currentFormulaBaseStatsSource,
  engineGrowthPrecision: 'source_float_no_intermediate_rounding',
  priorRelease: currentVersionProjection.packageId,
}

export const candidateCalculationPackage = Object.freeze({
  packageId: `soda-calculation-candidate-${currentAgentMechanicIdentity.gameVersion}`,
  packageVersion: '3.2-incremental-local-r1',
  gameVersion: currentAgentMechanicIdentity.gameVersion,
  contentHash: stableContentHash(sourceBinding),
  sourceBinding,
  status: 'candidate' as const,
  // This is a lineage pointer. It is not a claim that an old reader is safe.
  rollbackPackageId: currentVersionProjection.packageId,
})
