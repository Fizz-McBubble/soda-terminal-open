import { describe, expect, it } from 'vitest'
import { getReviewedExternalSupportFact } from './reviewedExternalSupportFacts'
import { resolveReviewedZhaoHpTarget } from './reviewedZhaoSupportTarget'
import { reviewedTargetPanelGuidance } from './reviewedTargetPanelGuidance'

describe('source-bound Zhao initial HP target', () => {
  it('uses the retained mechanic cap independently of the guide minimum', () => {
    const source = getReviewedExternalSupportFact('agent-zhao')!.effects.find(
      (row) => row.channel === 'all_damage_bonus',
    )!
    const input = { agentId: 'agent-zhao', coreLevel: 7 }
    expect(resolveReviewedZhaoHpTarget(input)?.minimum).toBe(source.value.initialMaxHpAtMaximum)
    expect(resolveReviewedZhaoHpTarget(input)?.minimum).toBe(27000)
    expect(resolveReviewedZhaoHpTarget(input)?.conditions).toContain(
      '核心技7；追加能力队伍条件成立且位于以太帷幕中。',
    )
    expect(
      (reviewedTargetPanelGuidance('agent-zhao')!.value as { hp: { min: number } }).hp.min,
    ).toBe(25000)
  })
  it.each([undefined, 0, 6, 8])(
    'does not extrapolate the reviewed core7 context to %s',
    (coreLevel) => {
      expect(resolveReviewedZhaoHpTarget({ agentId: 'agent-zhao', coreLevel })).toBeNull()
    },
  )
})
