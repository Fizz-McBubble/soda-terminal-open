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
    // The adopted 3.3 reference view retains the original dated observations as
    // counterevidence only. Their evidenceVersion stays 3.2.3 / 3.1; they do not
    // become current 3.3 measurements. Unknown future views cannot borrow them.
    const datasets: readonly PerformanceInput[] =
      version === '3.2' || version === '3.3'
        ? [performance323, performance31]
        : version === '3.1'
          ? [performance31]
          : []
    index = createPerformancePartitionEvidenceIndex(datasets)
    compiledIndexes.set(version, index)
  }
  return index.review(strongerIds, weakerIds)
}
