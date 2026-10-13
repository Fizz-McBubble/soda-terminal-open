import { describe, expect, it } from 'vitest'
import {
  orderComparableBangbooGroups,
  selectTargetTeamBangbooShortlist,
  type ShortlistBangbooOption,
} from './targetTeamBangbooShortlist'
import { areComparisonKeysEquivalent, compareBangbooTeamOptions } from './bangbooTeamFit'

const key = {
  purpose: 'energy' as const,
  unit: 'energy',
  receiver: 'pickup_agent',
  trigger: 'active',
  isDeterministic: true,
  deliveryModel: 'pickup',
}
const option = (
  id: string,
  purpose: ShortlistBangbooOption['primaryPurpose'],
  value = 1,
  trigger = 'active',
): ShortlistBangbooOption => ({
  bangbooId: id,
  activationStatus: 'active',
  requiresRaisedStars: false,
  recipientFit: 'direct',
  primaryPurpose: purpose,
  comparableSlice: { key: { ...key, purpose, trigger }, value },
})
const ids = (options: readonly ShortlistBangbooOption[]) => options.map((row) => row.bangbooId)

describe('bounded Bangboo shortlist with strictly grouped numeric comparisons', () => {
  it('covers another purpose even when three reviewed options share one purpose', () => {
    const reviewed = [
      option('reviewed-default', 'anomaly'),
      option('reviewed-second', 'anomaly'),
      option('reviewed-third', 'anomaly'),
    ]
    const selected = selectTargetTeamBangbooShortlist({
      reviewed,
      alternatives: [option('energy', 'energy'), option('daze', 'daze')],
      hasOrdinaryEnergyRecipient: true,
      limit: 3,
    })
    expect(ids(selected)).toEqual(['reviewed-default', 'energy', 'daze'])
    expect(new Set(selected.map((row) => row.primaryPurpose)).size).toBe(3)
  })
  it('prefers a larger slice value only inside the same complete comparison key', () => {
    const low = option('low', 'energy', 2)
    const different = option('different-key', 'energy', 10000, 'different-trigger')
    const high = option('high', 'energy', 10)
    expect(ids(orderComparableBangbooGroups([low, different, high], new Set(), true))).toEqual([
      'high',
      'different-key',
      'low',
    ])
    expect(ids(orderComparableBangbooGroups([different, low], new Set(), true))).toEqual([
      'different-key',
      'low',
    ])
    expect(ids(orderComparableBangbooGroups([low, different], new Set(), true))).toEqual([
      'low',
      'different-key',
    ])
  })
  it('keeps group slots and equal-value order stable across repeated sorting', () => {
    const rows = [
      option('low', 'energy', 2),
      option('other', 'daze', 999),
      option('high-first', 'energy', 10),
      option('high-second', 'energy', 10),
    ]
    const ordered = orderComparableBangbooGroups(rows, new Set(), true)
    expect(ids(ordered)).toEqual(['high-first', 'other', 'high-second', 'low'])
    expect(ids(orderComparableBangbooGroups(ordered, new Set(), true))).toEqual(ids(ordered))
    // Qualitative priorities are independent of the numeric/key partial relation.
    const raised = { ...rows[0]!, requiresRaisedStars: true }
    const general = { ...rows[0]!, recipientFit: 'general' }
    const direct = rows[0]!
    expect(compareBangbooTeamOptions(direct, general)).toBeLessThan(0)
    expect(compareBangbooTeamOptions(general, raised)).toBeLessThan(0)
    expect(compareBangbooTeamOptions(direct, raised)).toBeLessThan(0)
  })
  it('never replaces the reviewed default with a larger same-key mechanic value', () => {
    const reviewed = option('reviewed-default', 'energy', 1)
    const selected = selectTargetTeamBangbooShortlist({
      reviewed: [reviewed],
      alternatives: [
        option('higher', 'energy', 100),
        option('heal', 'sustain'),
        option('stun', 'daze'),
      ],
      hasOrdinaryEnergyRecipient: true,
      limit: 3,
    })
    expect(ids(selected)).toEqual(['reviewed-default', 'heal', 'stun'])
  })
  it('does not compare across investment or qualitative fit priorities', () => {
    const direct = option('direct', 'energy', 1)
    const general = { ...option('general', 'energy', 100), recipientFit: 'general' }
    const raised = { ...option('raised', 'energy', 1000), requiresRaisedStars: true }
    expect(ids(orderComparableBangbooGroups([raised, general, direct], new Set(), true))).toEqual([
      'direct',
      'general',
      'raised',
    ])
  })
  it('returns only distinct active IDs and never pads with inactive or unknown rows', () => {
    const active = option('active', 'daze')
    const selected = selectTargetTeamBangbooShortlist({
      reviewed: [],
      alternatives: [
        active,
        active,
        { ...option('inactive', 'energy'), activationStatus: 'inactive' },
        { ...option('unknown', 'sustain'), activationStatus: 'unknown' },
      ],
      hasOrdinaryEnergyRecipient: true,
      limit: 3,
    })
    expect(ids(selected)).toEqual(['active'])
  })
  it('does not prioritize normal energy without an ordinary recipient', () => {
    const selected = selectTargetTeamBangbooShortlist({
      reviewed: [],
      alternatives: [
        option('energy', 'energy', 999),
        option('daze', 'daze'),
        option('heal', 'sustain'),
        option('damage', 'bangboo_damage'),
      ],
      hasOrdinaryEnergyRecipient: false,
      limit: 3,
    })
    expect(ids(selected)).toEqual(['daze', 'heal', 'damage'])
  })
  it('compares every added key field and ignores field insertion order', () => {
    const left = { ...key, cooldownSeconds: 10, durationSeconds: 5, targetAction: 'basic' }
    const same = { targetAction: 'basic', durationSeconds: 5, cooldownSeconds: 10, ...key }
    expect(areComparisonKeysEquivalent(left, same)).toBe(true)
    for (const changed of [
      { ...left, cooldownSeconds: 20 },
      { ...left, durationSeconds: 8 },
      { ...left, targetAction: 'special' },
      { ...left, capacityBasis: 'different-capacity' },
      { ...left, additionalSourceCondition: 'new-condition' },
    ])
      expect(areComparisonKeysEquivalent(left, changed)).toBe(false)
  })
})
