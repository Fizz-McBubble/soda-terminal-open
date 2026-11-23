import { describe, expect, it } from 'vitest'
import {
  reviewedAgentPanelBaseline32,
  getReviewedRuptureResourceBaseline,
} from './reviewedAgentPanelBaseline32'

describe('reviewed ordinary-energy panel baseline', () => {
  it('retains per-agent resource evidence and never extrapolates Yixuan efficiency', () => {
    for (const id of [
      'agent-yixuan',
      'agent-banyue',
      'agent-yidhari',
      'agent-starlight-billy',
      'agent-manato',
    ]) {
      const entry = getReviewedRuptureResourceBaseline(id)!
      expect(entry.base.maxAdrenaline).toBe(120)
      expect(entry.source.sha256).toMatch(/^[a-f0-9]{64}$/)
      if (id === 'agent-yixuan') expect(entry.base.adrenalineGenerationRate).toBe(0)
      else expect(entry.base.adrenalineGenerationRate).toBeUndefined()
    }
    expect(getReviewedRuptureResourceBaseline('agent-anby')).toBeUndefined()
  })
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
