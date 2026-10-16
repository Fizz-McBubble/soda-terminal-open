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
      '初始生命27000可使追加能力增益满档；该生命目标不随核心技等级变化。',
    )
    expect(
      (reviewedTargetPanelGuidance('agent-zhao')!.value as { hp: { min: number } }).hp.min,
    ).toBe(25000)
  })
  it.each([undefined, null, 1, 2, 3, 4, 5, 6, 7])(
    'keeps the core-independent Additional Ability target at core %s',
    (coreLevel) => {
      expect(resolveReviewedZhaoHpTarget({ agentId: 'agent-zhao', coreLevel })?.minimum).toBe(27000)
    },
  )
  it('does not assign Zhao’s target to other agents', () => {
    expect(resolveReviewedZhaoHpTarget({ agentId: 'agent-sunna', coreLevel: 7 })).toBeNull()
  })
})
