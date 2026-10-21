import { describe, expect, it } from 'vitest'
import { reviewedAgentPanelBaseline32 } from './reviewedAgentPanelBaseline32'

describe('reviewed ordinary-energy panel baseline', () => {
  it('binds the normal energy values to a pinned source and explicit boundary', () => {
    expect(reviewedAgentPanelBaseline32.normalEnergy).toMatchObject({
      generationRate: 100,
      maxEnergy: 120,
    })
    expect(reviewedAgentPanelBaseline32.source).toMatchObject({
      sourceVersion: '2.0',
      contentHash: '6D0B2DBD84DAD9F853DF168A59A47939967BB8BBC2CEBC29077F531075DB6FAA',
    })
    expect(reviewedAgentPanelBaseline32.normalEnergy.applicability).toContain(
      '不适用于闪能、锐能或其他具名资源',
    )
    expect(reviewedAgentPanelBaseline32.boundary).toContain('独立面板字段')
    expect(reviewedAgentPanelBaseline32.identity).toMatch(/^fnv1a-/)
  })
})
