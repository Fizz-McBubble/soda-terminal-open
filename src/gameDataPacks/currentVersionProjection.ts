import { gameBase31Current } from './baseline'
import { gameData31CurrentCanonical } from './gameData31CurrentCanonical'

/**
 * The single player-facing current-version projection. It identifies the installed
 * current read view without promoting the canonical field-level evidence strength.
 */
export const currentVersionProjection = {
  id: 'current-version-projection-3.1',
  gameVersion: gameData31CurrentCanonical.gameVersion,
  packageId: gameBase31Current.id,
  packageVersion: gameBase31Current.packageVersion,
  rollbackPackageId: gameBase31Current.rollbackTo,
  lifecycle: gameData31CurrentCanonical.lifecycle,
  fieldBoundary: gameData31CurrentCanonical.boundary,
} as const
