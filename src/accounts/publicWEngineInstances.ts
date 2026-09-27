import {
  makeWEngineCopyId,
  normalizeWEngineInstances,
  usesDefaultWEngineRefinement as usesDefaultRefinement,
  withDefaultWEngineRefinement as withDefaultRefinement,
  type WEngineCopy,
} from './wEngineInstanceRules'
import sRankIds from './publicWEngineSIds.data.json'

/** Reviewed S-rank projection for the public browser; the rule body itself is shared. */
const sRankWEngineIds = new Set(sRankIds)

export { makeWEngineCopyId, normalizeWEngineInstances }
export type { WEngineCopy }

export function usesDefaultWEngineRefinement(copy: WEngineCopy) {
  return usesDefaultRefinement(sRankWEngineIds, copy)
}

export function withDefaultWEngineRefinement(copy: WEngineCopy): WEngineCopy {
  return withDefaultRefinement(sRankWEngineIds, copy)
}
