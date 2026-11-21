import {
  replaceTeamIntrinsicIndex,
  usesTeamStartupIntrinsicIndex,
} from './current31TeamIntrinsicIndex'
import { replaceGenericRankingIndex } from './teamGenericRanking'

let loading: Promise<void> | undefined

export function ensureFullTeamIndexes() {
  if (!usesTeamStartupIntrinsicIndex()) return Promise.resolve()
  loading ??= Promise.all([
    import('../gameDataPacks/generated/current31-team-intrinsic-index.v1.json'),
    import('../gameDataPacks/generated/generic-team-ranking.v1.json'),
  ])
    .then(([intrinsic, generic]) => {
      // Validate both artifacts before publishing either. A failed import may retry.
      const installIntrinsic = replaceTeamIntrinsicIndex(intrinsic.default)
      const installGeneric = replaceGenericRankingIndex(generic.default, installIntrinsic.binding)
      installIntrinsic.commit()
      installGeneric()
    })
    .catch((error: unknown) => {
      loading = undefined
      throw error
    })
  return loading
}
