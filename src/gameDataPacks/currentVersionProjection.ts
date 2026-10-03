import { currentVersionAdoption32, gameBase32Current } from './currentVersionAdoption32'

/**
 * The single player-facing current-version projection. It identifies the installed
 * current read view without promoting the canonical field-level evidence strength.
 */
export const currentVersionProjection = {
  id: 'current-version-projection-3.2',
  gameVersion: currentVersionAdoption32.gameVersion as string,
  packageId: gameBase32Current.id,
  packageVersion: gameBase32Current.packageVersion,
  rollbackPackageId: gameBase32Current.rollbackTo,
  lifecycle: currentVersionAdoption32.lifecycle,
  fieldBoundary: currentVersionAdoption32.boundary,
  adoptionId: currentVersionAdoption32.id,
  adoptionContentHash: currentVersionAdoption32.contentHash,
  sourceCommit: currentVersionAdoption32.sourceIdentity.upstreamCommit,
  phase: currentVersionAdoption32.phase,
  scopeManifestId: currentVersionAdoption32.scopeIdentity.manifestId,
  scopeContentHash: currentVersionAdoption32.scopeIdentity.contentHash,
  directoryCoverage: currentVersionAdoption32.scopeIdentity.coverage,
  compatibilityRecovery: currentVersionAdoption32.compatibilityRecovery,
} as const
