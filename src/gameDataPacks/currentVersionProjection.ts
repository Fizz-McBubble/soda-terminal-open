import { currentVersionAdoption32, gameBase32Current } from './currentVersionAdoption32'
import { currentVersionAdoption33, gameBase33Current } from './currentVersionAdoption33'
import { currentGameDataSelection } from './currentGameDataSelection'

const adoption =
  currentGameDataSelection.gameVersion === '3.3'
    ? currentVersionAdoption33
    : currentVersionAdoption32
export const compiledCurrentGameBase =
  currentGameDataSelection.gameVersion === '3.3' ? gameBase33Current : gameBase32Current

if (
  currentGameDataSelection.gameVersion !== adoption.gameVersion ||
  currentGameDataSelection.packageId !== compiledCurrentGameBase.id ||
  currentGameDataSelection.phase !== adoption.phase
)
  throw new Error('Installed game-data selection does not match the adopted package.')

export type CurrentVersionAdoptionSourceIdentity =
  | {
      readonly provider: 'genshin_optimizer'
      readonly commit: string
      readonly deltaSha256: string
    }
  | {
      readonly provider: 'nanoka'
      readonly providerManifestSha256: string
      readonly deltaSha256: string
    }

const adoptionSourceIdentity: CurrentVersionAdoptionSourceIdentity =
  'upstreamCommit' in adoption.sourceIdentity
    ? {
        provider: 'genshin_optimizer',
        commit: adoption.sourceIdentity.upstreamCommit,
        deltaSha256: adoption.sourceIdentity.deltaIdentity.deltaSha256,
      }
    : {
        provider: 'nanoka',
        providerManifestSha256: adoption.sourceIdentity.providerManifestSha256,
        deltaSha256: adoption.sourceIdentity.deltaSha256,
      }

/** Installed-package identity only; old per-field GO provenance remains independent. */
export function matchesCurrentVersionAdoptionSourceIdentity(
  candidate: CurrentVersionAdoptionSourceIdentity | undefined,
  targetVersion: string,
) {
  if (
    !candidate ||
    targetVersion !== adoption.gameVersion ||
    candidate.provider !== adoptionSourceIdentity.provider ||
    candidate.deltaSha256 !== adoptionSourceIdentity.deltaSha256
  )
    return false
  if (candidate.provider === 'nanoka' && adoptionSourceIdentity.provider === 'nanoka')
    return candidate.providerManifestSha256 === adoptionSourceIdentity.providerManifestSha256
  return (
    candidate.provider === 'genshin_optimizer' &&
    adoptionSourceIdentity.provider === 'genshin_optimizer' &&
    candidate.commit === adoptionSourceIdentity.commit
  )
}

/**
 * The single player-facing current-version projection. It identifies the installed
 * current read view without promoting the canonical field-level evidence strength.
 */
export const currentVersionProjection = {
  id: `current-version-projection-${adoption.gameVersion}`,
  gameVersion: adoption.gameVersion as string,
  packageId: compiledCurrentGameBase.id,
  packageVersion: compiledCurrentGameBase.packageVersion,
  rollbackPackageId: compiledCurrentGameBase.rollbackTo,
  lifecycle: adoption.lifecycle,
  fieldBoundary: adoption.boundary,
  adoptionId: adoption.id,
  adoptionContentHash: adoption.contentHash,
  adoptionSourceIdentity,
  sourceCommit:
    'upstreamCommit' in adoption.sourceIdentity ? adoption.sourceIdentity.upstreamCommit : null,
  phase: adoption.phase,
  scopeManifestId: adoption.scopeIdentity.manifestId,
  scopeContentHash: adoption.scopeIdentity.contentHash,
  directoryCoverage: adoption.scopeIdentity.coverage,
  compatibilityRecovery: adoption.compatibilityRecovery,
} as const
