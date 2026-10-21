import { gameData31CatalogIntake } from './gameData31CatalogIntake'
import { gameData32CatalogEntities } from './gameData32CatalogEntities'
import { gameData33CatalogEntities } from './gameData33CatalogEntities'
import { currentGameDataSelection } from './currentGameDataSelection'

/** Installed additions; historical intake remains a source-version record. */
export const catalogEntities32 = [...gameData31CatalogIntake.entities, ...gameData32CatalogEntities]

export const catalogEntities33 = [...catalogEntities32, ...gameData33CatalogEntities]
export const currentCatalogEntities =
  currentGameDataSelection.gameVersion === '3.3' ? catalogEntities33 : catalogEntities32
