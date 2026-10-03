import { stableContentHash } from '../gameDataPacks/types'
import { anomalyDamageCoreHash } from './anomalyDamageCore'

/** Source identities bind arithmetic; they do not certify caller observations or a cycle. */
export const commonAnomalySettlementIdentity32 = Object.freeze({
  revision: 'explicit-homogeneous-buildup-attribution-r1',
  arithmeticCoreHash: anomalyDamageCoreHash,
  repository: 'https://github.com/frzyc/genshin-optimizer',
  commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  license: 'MIT',
  sources: [
    {
      path: 'libs/zzz/formula/src/data/char/util.ts',
      sha256: '0CD0429E53E7523AFE601A98BA09F3507F132FF820C09942B7B4993BADFBBF21',
      locator: '361-386,482-557: anomaly, polarity disorder, vortex and abloom instances',
    },
    {
      path: 'libs/zzz/formula/src/data/common/prep.ts',
      sha256: '45D051C23C6055A75EE0B6A894659244754BCE298683F409667419B43E58ADF9',
      locator: '28-42: per-owner complete anomaly expression',
    },
    {
      path: 'libs/zzz/formula/src/data/common/dmg.ts',
      sha256: '43C1755F8DECECB32F5710F815A8A67C76B4C05F2AD0467A9D3F9714C0B1A3E5',
      locator: '18-77,118-141: shared factors and anomaly critical multiplier',
    },
    {
      path: 'libs/zzz/dm-localization/assets/locales/en/tooltips_gen.json',
      sha256: 'A9A5443E5E12716DE3F4BF08CB101266A8F2EA61ECCDC563BEF16B98C900E06D',
      locator: '1000023.desc: per-attack buildup contribution to Anomaly Effect Strength',
    },
  ],
  supportedBoundary: 'same-element same-target complete agent buildup with identical parameters',
  unresolved: [
    'heterogeneous snapshot aggregation: weighted full strength versus weighted factor product',
    'cross-attribute Vortex and Contamination strength ownership',
    'Bangboo contribution eligibility and normalization',
    'trigger eligibility, buildup thresholds, target transitions and fixed-cycle timing',
  ],
  conflictingAggregationReference: {
    repository: 'https://github.com/ZSim-Dev/ZSim',
    commit: 'e248e9f149a6b889290579d8e673e132be9bde31',
    paths: [
      'zsim/sim_progress/anomaly_bar/AnomalyBarClass.py:257-283',
      'zsim/sim_progress/ScheduledEvent/CalAnomaly.py:195-231',
    ],
    interpretation: 'weighted factor array first; multiply those factors afterwards',
    adoption: 'counterevidence_only',
  },
})

export const commonAnomalySettlementHash32 = stableContentHash(commonAnomalySettlementIdentity32)
