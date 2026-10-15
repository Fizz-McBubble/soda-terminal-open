import performance323 from '../gameDataPacks/data/reviewed-team-performance.3.2.3.json'
import performance31 from '../gameDataPacks/data/reviewed-team-performance.3.1.json'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import {
  createPerformancePartitionEvidenceIndex,
  reviewProductionPairwiseDatasets,
  type PerformanceInput,
} from './teamPerformancePartitionEvidence'
export { reviewProductionPairwiseDatasets } from './teamPerformancePartitionEvidence'
export type { PerformanceInput } from './teamPerformancePartitionEvidence'

const compiledIndexes = new Map<
  string,
  ReturnType<typeof createPerformancePartitionEvidenceIndex>
>()

/** Published aggregates may veto an unconditional local source preference.
 * They do not create an opposite strength rating or additional training labels. */
export function reviewCurrent31ProductionPairwiseEvidence(
  strongerIds: readonly string[],
  weakerIds: readonly string[],
  input?: PerformanceInput,
) {
  if (input) return reviewProductionPairwiseDatasets(strongerIds, weakerIds, [input])
  const version = currentVersionProjection.gameVersion
  let index = compiledIndexes.get(version)
  if (!index) {
    // Current evidence augments, not erases, retained counterevidence. Unknown
    // future read views cannot borrow a reviewed observation from either version.
    const datasets: readonly PerformanceInput[] =
      version === '3.2' ? [performance323, performance31] : version === '3.1' ? [performance31] : []
    index = createPerformancePartitionEvidenceIndex(datasets)
    compiledIndexes.set(version, index)
  }
  return index.review(strongerIds, weakerIds)
}
