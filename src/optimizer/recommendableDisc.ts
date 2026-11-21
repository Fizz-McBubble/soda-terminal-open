import type { DriveDisc } from '../domain/schemas'

/** Missing rarity is unknown, including on legacy records; it is not evidence of S. */
export function isRecommendableDisc(disc: DriveDisc): boolean {
  return disc.rarity === 'S'
}
