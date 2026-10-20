import { describe, expect, it } from 'vitest'
import { evaluateSkillInvestmentNextLevel } from './skillInvestmentNextLevel'
import { resolveSkillInvestmentMaterials } from './skillInvestmentMaterials'
import { fieldTimeIndependentSkillInvestment } from './skillInvestmentPolicy'
import {
  projectSkillInvestmentNextLevels,
  resolveSkillInvestmentMindscapeBonus,
} from '../decision/skillInvestmentProjection'

const eventId = 'basic.BasicAttackSwiftedge.hit-0'
const example = {
  agentId: 'agent-ye-shunguang',
  skill: 'basic' as const,
  currentLevel: 11,
  targetLevel: 12,
  effectiveLevelBonus: 0,
  eventIds: [eventId],
}

describe('source-bound next paid skill level', () => {
  it('separates real same-event damage and daze coefficients at 11 to 12', () => {
    const result = evaluateSkillInvestmentNextLevel(example)
    expect(result.status).toBe('supported')
    const event = result.events[0]
    expect(event?.status).toBe('supported')
    if (!event || event.status !== 'supported') throw new Error('missing source event')
    expect(event.damageCoefficient.before).toBeCloseTo(1.524)
    expect(event.damageCoefficient.after).toBeCloseTo(1.597)
    expect(event.damageCoefficient.delta).toBeCloseTo(0.073)
    expect(event.dazeCoefficient.before).toBeCloseTo(0.395)
    expect(event.dazeCoefficient.after).toBeCloseTo(0.408)
    expect(event.dazeCoefficient.delta).toBeCloseTo(0.013)
    expect(event.anomalyCoefficient).toBeDefined()
    expect(event.resourceRecoveryGains).toBeDefined()
    expect(event.quantityUnit).toBe('coefficient_use')
    expect(event.sourceRefs.every((ref) => !ref.includes('undefined'))).toBe(true)
    expect(result.materials).toMatchObject({
      status: 'supported',
      fromBaseLevel: 11,
      toBaseLevel: 12,
      materials: [
        { itemId: '10', quantity: 135000 },
        { itemId: '100130', quantity: 15 },
        { itemId: '100941', quantity: 1 },
      ],
    })
  })
  it('uses actual +4 mindscape offset: effective 15 can upgrade paid 11 to 12, effective 16', () => {
    const result = evaluateSkillInvestmentNextLevel({
      ...example,
      currentLevel: 15,
      targetLevel: 16,
      effectiveLevelBonus: 4,
    })
    expect(result).toMatchObject({
      status: 'supported',
      fromBaseLevel: 11,
      toBaseLevel: 12,
      fromLevel: 15,
      toLevel: 16,
    })
    expect(result.materials).toMatchObject({
      status: 'supported',
      materials: [{ quantity: 135000 }, { quantity: 15 }, { quantity: 1 }],
    })
    expect(
      evaluateSkillInvestmentNextLevel({
        ...example,
        currentLevel: 16,
        targetLevel: 16,
        effectiveLevelBonus: 4,
      }).status,
    ).toBe('no_upgrade')
  })
  it('never assumes missing bonus is zero, invents +3, or exceeds paid/source cap', () => {
    expect(
      evaluateSkillInvestmentNextLevel({ ...example, effectiveLevelBonus: undefined }).status,
    ).toBe('unknown')
    expect(
      evaluateSkillInvestmentNextLevel({
        ...example,
        currentLevel: 15,
        targetLevel: 16,
        effectiveLevelBonus: undefined,
      }).status,
    ).toBe('unknown')
    expect(evaluateSkillInvestmentNextLevel({ ...example, effectiveLevelBonus: 3 }).status).toBe(
      'unsupported',
    )
    expect(evaluateSkillInvestmentNextLevel({ ...example, targetLevel: 13 }).status).toBe(
      'unsupported',
    )
    expect(evaluateSkillInvestmentNextLevel({ ...example, currentLevel: null }).status).toBe(
      'unknown',
    )
    expect(evaluateSkillInvestmentNextLevel({ ...example, currentLevel: 10.5 }).status).toBe(
      'unsupported',
    )
  })
  it('preserves target/order and excludes other skills and unknown event IDs', () => {
    expect(evaluateSkillInvestmentNextLevel({ ...example, targetLevel: 10 }).status).toBe(
      'no_upgrade',
    )
    expect(evaluateSkillInvestmentNextLevel({ ...example, skill: 'special' }).status).toBe(
      'unsupported',
    )
    expect(evaluateSkillInvestmentNextLevel({ ...example, eventIds: ['missing'] }).status).toBe(
      'unsupported',
    )
    expect(evaluateSkillInvestmentNextLevel({ ...example, agentId: 'missing' }).status).toBe(
      'unsupported',
    )
  })
  it('reports core static growth and sourced materials separately from unknown conditional damage', () => {
    const result = evaluateSkillInvestmentNextLevel({
      agentId: example.agentId,
      skill: 'core',
      currentLevel: 6,
      targetLevel: 7,
    })
    expect(result.status).toBe('partial')
    expect(result.events).toEqual([])
    expect(result.materials).toMatchObject({
      status: 'supported',
      materials: [
        { itemId: '10', quantity: 200000 },
        { itemId: '110513', quantity: 30 },
        { itemId: '110008', quantity: 4 },
      ],
    })
    expect(result).toHaveProperty('coreGrowth')
    expect(
      evaluateSkillInvestmentNextLevel({
        agentId: example.agentId,
        skill: 'core',
        currentLevel: 7,
        targetLevel: 7,
      }).status,
    ).toBe('no_upgrade')
  })
  it('maps attribute-specific chips without substituting same-event damage attribute', () => {
    for (const [agentId, itemId] of [
      ['agent-anby', '100133'],
      ['agent-nicole', '100135'],
      ['agent-lycaon', '100132'],
      ['agent-soldier-11', '100131'],
    ] as const) {
      expect(
        resolveSkillInvestmentMaterials({ agentId, skill: 'basic', currentBaseLevel: 11 }),
      ).toMatchObject({
        status: 'supported',
        materials: [{ itemId: '10' }, { itemId }, { itemId: '100941' }],
      })
    }
    expect(
      resolveSkillInvestmentMaterials({
        agentId: example.agentId,
        skill: 'basic',
        currentBaseLevel: 12,
      }).status,
    ).toBe('unknown')
  })
  it('attaches evidence through existing recommendation helper without changing source priority', () => {
    const result = fieldTimeIndependentSkillInvestment({
      skill: 'basic',
      priorityIndex: 0,
      explicitPrimary: true,
      explicitSupplemental: false,
      hasScalableMechanic: true,
      nextLevelContext: example,
    })
    expect(result).toMatchObject({
      band: 'max_priority',
      targetLevel: 12,
      nextLevelEvidence: { status: 'supported' },
    })
  })
  it('uses only explicitly mapped character core materials, not another character of the same attribute', () => {
    expect(
      resolveSkillInvestmentMaterials({
        agentId: 'agent-nicole',
        skill: 'core',
        currentBaseLevel: 6,
      }),
    ).toMatchObject({
      status: 'supported',
      materials: [
        { itemId: '10', quantity: 200000 },
        { itemId: '110501', quantity: 30 },
        { itemId: '110001', quantity: 4 },
      ],
    })
    expect(
      resolveSkillInvestmentMaterials({
        agentId: 'agent-lycaon',
        skill: 'core',
        currentBaseLevel: 6,
      }),
    ).toMatchObject({
      status: 'supported',
      materials: [
        { itemId: '10', quantity: 200000 },
        { itemId: '110503', quantity: 30 },
        { itemId: '110003', quantity: 4 },
      ],
    })
    expect(
      resolveSkillInvestmentMaterials({
        agentId: 'agent-ye-shunguang',
        skill: 'core',
        currentBaseLevel: 6,
      }),
    ).toMatchObject({
      status: 'supported',
      materials: [
        { itemId: '10', quantity: 200000 },
        { itemId: '110513', quantity: 30 },
        { itemId: '110008', quantity: 4 },
      ],
    })
  })
  it('keeps rate coefficient units without making up exposure or attack count', () => {
    const result = evaluateSkillInvestmentNextLevel({
      ...example,
      agentId: 'agent-roxy',
      skill: 'special',
      eventIds: ['special.EXSpecialAttackDontCatchAChill.hit-1'],
    })
    expect(result.status).toBe('supported')
    expect(result.events[0]).toMatchObject({ status: 'supported', quantityUnit: 'per_second' })
    expect(result).not.toHaveProperty('durationSeconds')
    expect(result).not.toHaveProperty('dps')
  })
  it('projects roster effective levels and preserves explicit targets and source order', () => {
    expect([0, 2, 3, 4, 5, 6].map(resolveSkillInvestmentMindscapeBonus)).toEqual([0, 0, 2, 2, 4, 4])
    expect(resolveSkillInvestmentMindscapeBonus(null)).toBeNull()
    const rows = projectSkillInvestmentNextLevels({
      agentId: example.agentId,
      mindscape: 6,
      skillLevels: { basic: 15, dodge: 15, assist: 15, special: 15, chain: 15, core: 7 },
      rows: [
        { key: 'basic', targetLevel: 16, priority: 3 },
        { key: 'core', targetLevel: 7, priority: 1 },
      ],
    })
    expect(rows.map((row) => row.priority)).toEqual([3, 1])
    expect(rows[0]?.nextLevelEvidence).toMatchObject({
      status: 'supported',
      fromBaseLevel: 11,
      toLevel: 16,
    })
    expect(rows[1]?.nextLevelEvidence.status).toBe('no_upgrade')
  })
})
