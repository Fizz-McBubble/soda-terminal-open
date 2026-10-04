import agentCatalog from '../generated/current-agent-mechanic-catalog.v1.json'
import { stableContentHash } from '../types'
import { sheerForceCommonSource32 } from '../../calculation/currentSourceBoundSheerForceIdentity32'

export const currentCoreGrowthSource = Object.freeze({
  version: 'cumulative-source-core-growth-v2',
  commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  path: 'libs/zzz/formula/src/data/char/util.ts',
  sha256: '0CD0429E53E7523AFE601A98BA09F3507F132FF820C09942B7B4993BADFBBF21',
  locator: '402-409,457-460',
  rule: 'explicit_core1_source_zero_row; one_cumulative_source_row_per_learned_core2_to7',
})

/** Small fingerprint input; no panel, expression runtime or character contract imports. */
export const currentCoreGrowthIdentity32 = Object.freeze({
  algorithmRevision: 'core-row-once-explicit-zero-flat-core-before-static-percent-v3',
  source: currentCoreGrowthSource,
  dependencies: [
    { ...sheerForceCommonSource32, locator: '40-57' },
    {
      path: 'libs/zzz/formula/src/data/util/listing.ts',
      locator: '53-61',
      sha256: '9D16D25CD4DB732CBAED22899FD21D0DD350222F57E27B10307836B7D5768372',
    },
  ],
  growthInputHash: stableContentHash(
    agentCatalog.items.map((actor) => ({
      externalId: actor.externalId,
      source: actor.source,
      coreStats: actor.coreStats,
    })),
  ),
  basis: 'independent_source_growth_not_menu_observed_anchor',
})
export const currentCoreGrowthHash32 = stableContentHash(currentCoreGrowthIdentity32)
