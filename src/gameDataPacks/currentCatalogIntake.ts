import { gameData31CatalogIntake } from './gameData31CatalogIntake'
import { gameData32CatalogEntities } from './gameData32CatalogEntities'

/** Installed additions; historical intake remains a source-version record. */
export const currentCatalogEntities = [
  ...gameData31CatalogIntake.entities,
  ...gameData32CatalogEntities,
]
