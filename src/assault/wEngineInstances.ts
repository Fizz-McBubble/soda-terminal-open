import {
  makeWEngineCopyId,
  normalizeWEngineInstances,
  usesDefaultWEngineRefinement as usesDefaultRefinement,
  withDefaultWEngineRefinement as withDefaultRefinement,
  type WEngineCopy,
} from '../accounts/wEngineInstanceRules'
import wEngineCatalog from './data/wEngineCatalog.3.0.json'

/** Desktop authority for the S-rank default-refinement rule. */
const sRankWEngineIds = new Set(
  wEngineCatalog.items.filter((item) => item.rarity === 'S').map((item) => item.id),
)

export { makeWEngineCopyId, normalizeWEngineInstances }
export type { WEngineCopy }

export function usesDefaultWEngineRefinement(copy: WEngineCopy) {
  return usesDefaultRefinement(sRankWEngineIds, copy)
}

export function withDefaultWEngineRefinement(copy: WEngineCopy): WEngineCopy {
  return withDefaultRefinement(sRankWEngineIds, copy)
}
