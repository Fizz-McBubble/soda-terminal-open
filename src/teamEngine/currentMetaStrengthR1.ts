import type { CurrentMetaStrengthR1, TeamEngineEvidenceRef } from './contracts'
import { current31LegacyCoverageMetaBands } from './current31LegacyCoverage'

const currentMetaOverview: TeamEngineEvidenceRef = {
  sourceId: 'prydwen-current-3.1-meta-review-2026-08-26',
  gameVersion: '3.1',
  status: 'candidate',
  locator:
    'Current 3.1 team/agent benchmark cross-check; supports coarse apex/meta/viable bands only, not numeric strength or a total order.',
}

const currentMetaCrossCheck: TeamEngineEvidenceRef = {
  sourceId: 'icyveins-current-3.1-team-review-2026-08-26',
  gameVersion: '3.1',
  status: 'candidate',
  locator:
    'Current 3.1 team guidance cross-check; adopted only where it agrees on a coarse band and applicability boundary.',
}

const yixuanComparative: TeamEngineEvidenceRef = {
  sourceId: 'prydwen-yixuan-current-team-comparative-2026-08-26',
  gameVersion: '3.1',
  status: 'candidate',
  locator:
    'Current Yixuan team guidance identifies Lucia as the dedicated Rupture support and Dialyn as the preferred stun partner; supports only Lucia/Dialyn above Pan Yinhu/Astra within meta.',
}

const coarseBandRefs = [currentMetaOverview, currentMetaCrossCheck]

export const current31VerticalSliceMetaStrength: CurrentMetaStrengthR1 = {
  contract: 'soda-current-meta-strength/r1',
  kernelBands: [
    { kernelId: 'kernel-3.1-remielle-velina-aria', band: 'apex', refs: coarseBandRefs },
    { kernelId: 'kernel-3.1-remielle-velina-burnice', band: 'meta', refs: coarseBandRefs },
    { kernelId: 'kernel-3.1-remielle-velina-promeia', band: 'meta', refs: coarseBandRefs },
  ],
  partialOrder: [],
}

export const current31MetaStrengthR1: CurrentMetaStrengthR1 = {
  contract: 'soda-current-meta-strength/r1',
  kernelBands: [
    { kernelId: 'kernel-3.1-ye-dialyn-zhao', band: 'apex', refs: coarseBandRefs },
    { kernelId: 'kernel-3.1-remielle-velina-aria', band: 'apex', refs: coarseBandRefs },
    { kernelId: 'kernel-3.1-aria-sunna-yuzuha', band: 'meta', refs: coarseBandRefs },
    { kernelId: 'kernel-3.1-promeia-nangong-yuzuha', band: 'meta', refs: coarseBandRefs },
    { kernelId: 'kernel-3.1-yixuan-lucia-dialyn', band: 'meta', refs: coarseBandRefs },
    { kernelId: 'kernel-3.1-pyrois-norma-sunna', band: 'meta', refs: coarseBandRefs },
    { kernelId: 'kernel-3.1-yixuan-pan-astra', band: 'meta', refs: coarseBandRefs },
    { kernelId: 'kernel-3.1-remielle-velina-burnice', band: 'meta', refs: coarseBandRefs },
    { kernelId: 'kernel-3.1-remielle-velina-promeia', band: 'meta', refs: coarseBandRefs },
    { kernelId: 'kernel-3.1-zhu-yuan-qingyi-astra', band: 'viable', refs: coarseBandRefs },
    ...current31LegacyCoverageMetaBands,
  ],
  partialOrder: [
    {
      higherKernelId: 'kernel-3.1-yixuan-lucia-dialyn',
      lowerKernelId: 'kernel-3.1-yixuan-pan-astra',
      refs: [yixuanComparative],
    },
  ],
}

export const current31MetaStrengthR1Lineage = Object.freeze({
  contract: 'soda-current-meta-strength-lineage/v1' as const,
  gameVersion: '3.1',
  status: 'recovered_coarse_calibration' as const,
  n2DesignContractRowCount: 10,
  legacyCoverageRowCount: current31LegacyCoverageMetaBands.length,
  totalRowCount: current31MetaStrengthR1.kernelBands.length,
  highConfidencePairwiseCount: current31MetaStrengthR1.partialOrder.length,
  productAuthorityEligible: false,
  boundary:
    '该 13 队表是已恢复的 N2 粗粒度校准基线：10 条来自 N2 设计合同，3 条来自 legacy viable 覆盖。它可守住已知大方向和触发 violation，但不是 3.1 Gold Set、Reference Performance 或产品级总排序。',
})
