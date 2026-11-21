import { describe, expect, it } from 'vitest'
import { comparisonStatDeltaSummary } from './agentLoadoutComparisonPanelValues'

describe('comparison stat summary', () => {
  const stats = [
    { key: 'pen', label: '穿透值', unit: '' },
    { key: 'rate', label: '暴击率', unit: '%' },
  ]

  it('distinguishes a known zero change from missing values and a missing baseline', () => {
    expect(comparisonStatDeltaSummary(stats, { pen: 0, rate: 0 }, { pen: 0, rate: 0 }, true)).toBe(
      '所选属性无变化',
    )
    expect(comparisonStatDeltaSummary(stats, { pen: 0, rate: 0 }, { pen: 0 }, true)).toBe(
      '属性待核对',
    )
    expect(comparisonStatDeltaSummary(stats, { pen: 0, rate: 0 }, { pen: 2 }, true)).toBe(
      '穿透值 +2 · 部分属性待核对',
    )
    expect(comparisonStatDeltaSummary(stats, {}, {}, false)).toBe('尚无比较基线')
    expect(comparisonStatDeltaSummary([], {}, {}, true)).toBe('属性待核对')
  })
})
