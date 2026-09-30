import { describe, expect, it } from 'vitest'
import { scanMainStatDisplayValue } from './scanMainStatDisplay'

const legacy = { source: 'detail-main', rule: 'ocr_name_and_slot_value_rule' }
const next = { source: 'upstream-detail-roi', rule: 'exact_stat_catalog' }

describe('scan producer main-stat display contracts', () => {
  it.each([
    [46, 4, 15, 82, 83],
    [23, 3, 15, 36, 37],
    [79, 12, 15, 268, 269],
    [46, 3, 15, 73, 74],
    [31, 1, 12, 38, 39],
  ])(
    'selects one integer representation for base %s at level %s',
    (base, level, max, floor, round) => {
      expect(scanMainStatDisplayValue(base, level, max, 'flat', legacy)).toBe(floor)
      expect(scanMainStatDisplayValue(base, level, max, 'flat', next)).toBe(round)
      expect(scanMainStatDisplayValue(base, level, max, 'flat', undefined)).toBe(round)
    },
  )

  it('does not infer a legacy producer from partial or unrelated evidence', () => {
    expect(scanMainStatDisplayValue(46, 4, 15, 'flat', { ...legacy, source: 'manual' })).toBe(83)
    expect(scanMainStatDisplayValue(46, 4, 15, 'flat', { ...legacy, rule: 'other' })).toBe(83)
  })

  it('keeps percentage precision and exact endpoints for both producers', () => {
    for (const evidence of [legacy, next]) {
      expect(scanMainStatDisplayValue(6, 1, 15, 'percent', evidence)).toBeCloseTo(7.2)
      expect(scanMainStatDisplayValue(46, 0, 15, 'flat', evidence)).toBe(46)
      expect(scanMainStatDisplayValue(46, 15, 15, 'flat', evidence)).toBe(184)
      expect(scanMainStatDisplayValue(23, 15, 15, 'flat', evidence)).toBe(92)
    }
  })
})
