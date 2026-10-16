import { describe, expect, it, vi } from 'vitest'
import * as panels from '../calculation/outOfCombatPanel'
import { supportObjectiveFixture } from '../optimizer/candidatePanelObjective.testFixture'
import { candidatePanelInputForAgent } from '../optimizer/optimizeAccountBuildsPanelInput'
import {
  getCandidatePanelObjectiveTarget,
  projectCandidatePanelObjective,
  prepareCandidatePanelObjective,
} from '../optimizer/candidatePanelObjective'
import { getCurrentBuildTargetPanel } from './currentBuildAuthority'
import { reviewedContextualMechanicTargets } from './reviewedContextualTargetPanel'
import {
  targetPanelPresentation,
  targetPanelLowerBound,
} from '../application/buildTargetPresentation'
import { getCandidatePanelPolicyForContext } from './candidatePanelPolicy'

describe('source-bound contextual target panel', () => {
  it('shares every Pan and Yuzuha core curve, including Pan M6, with actual candidate preparation', () => {
    const rates = [0.09, 0.105, 0.12, 0.135, 0.15, 0.165, 0.18]
    const yuzuha = [1500, 1750, 2000, 2250, 2500, 2750, 3000]
    for (const [index, rate] of rates.entries()) {
      for (const mindscape of [0, 6]) {
        const context = { coreLevel: index + 1, mindscape }
        const expected = mindscape === 6 ? 720 / (rate + 0.06) : 540 / rate
        expect(
          targetPanelLowerBound(getCurrentBuildTargetPanel('agent-pan-yinhu', context), '攻击力'),
        ).toBeCloseTo(expected, 8)
        expect(
          getCandidatePanelPolicyForContext('agent-pan-yinhu', context)?.minimumAttack,
        ).toBeCloseTo(expected, 8)
      }
      const context = { coreLevel: index + 1 }
      expect(
        targetPanelLowerBound(getCurrentBuildTargetPanel('agent-yuzuha', context), '攻击力'),
      ).toBe(yuzuha[index])
      expect(getCandidatePanelPolicyForContext('agent-yuzuha', context)?.minimumAttack).toBe(
        yuzuha[index],
      )
    }
    for (const agentId of ['agent-astra', 'agent-pan-yinhu', 'agent-yuzuha']) {
      expect(getCandidatePanelPolicyForContext(agentId, { mindscape: 0 })).toBeNull()
      for (const coreLevel of [0, 1.5, 8])
        expect(getCandidatePanelPolicyForContext(agentId, { mindscape: 0, coreLevel })).toBeNull()
    }
  })
  it('retains all sourced low-core preparation curves instead of deleting Astra, Rina or Sigrid goals', () => {
    const pen = [96, 90, 84, 79.2, 76.8, 74.4, 72]
    const crit = [67, 61, 56, 50, 45, 39, 34]
    const astraRates = [0.22, 0.24, 0.26, 0.28, 0.3, 0.32, 0.35]
    for (const [index, value] of pen.entries()) {
      expect(
        targetPanelLowerBound(
          getCurrentBuildTargetPanel('agent-rina', { coreLevel: index + 1 }),
          '穿透率',
        ),
      ).toBeCloseTo(value, 8)
      expect(
        targetPanelLowerBound(
          getCurrentBuildTargetPanel('agent-sigrid', { coreLevel: index + 1 }),
          '暴击率',
        ),
      ).toBeCloseTo(crit[index], 8)
      for (const mindscape of [0, 2]) {
        const expected =
          mindscape === 2 ? 1600 / (astraRates[index] + 0.19) : 1200 / astraRates[index]
        const target = getCurrentBuildTargetPanel('agent-astra', {
          coreLevel: index + 1,
          mindscape,
        })
        expect(targetPanelLowerBound(target, '攻击力')).toBeCloseTo(expected, 8)
        expect(
          getCandidatePanelPolicyForContext('agent-astra', { coreLevel: index + 1, mindscape })
            ?.minimumAttack,
        ).toBeCloseTo(expected, 8)
      }
    }
    const early = getCurrentBuildTargetPanel('agent-astra', { coreLevel: 1, mindscape: 0 })!
    expect(targetPanelLowerBound(early, '攻击力')).toBeCloseTo(5454.545454545454, 8)
    const m2 = getCurrentBuildTargetPanel('agent-astra', { coreLevel: 7, mindscape: 2 })!
    expect(targetPanelLowerBound(m2, '攻击力')).toBeCloseTo(2962.962962962963, 8)
    expect(targetPanelLowerBound(m2, '攻击力')).not.toBeCloseTo(1600 / (0.35 * 1.19), 4)
    expect(targetPanelLowerBound(m2, '攻击力')).not.toBeCloseTo(1200 / (0.35 + 0.19), 4)
    expect(
      getCandidatePanelPolicyForContext('agent-astra', { coreLevel: 7, mindscape: 2 })
        ?.minimumAttack,
    ).toBeCloseTo(2962.962962962963, 8)
    expect(
      getCandidatePanelPolicyForContext('agent-astra', { coreLevel: 1, mindscape: 0 }),
    ).toMatchObject({ requiresActualCoreLevel: true, requiredFourPieceSet: 'set-astral-voice' })
    expect(early.value).toHaveProperty('guideObservation.atk.min', 3430)
    expect(getCurrentBuildTargetPanel('agent-sigrid', { coreLevel: 1 })!.value).toHaveProperty(
      'guideObservation.critRate',
      33.8,
    )
  })
  it('never lets menu ceil satisfy a fractional skill target or adds an unrelated AP tie-breaker', () => {
    const { agent, discs } = supportObjectiveFixture('agent-lucy')
    agent.skillLevels.special = 10
    const input = candidatePanelInputForAgent(agent)!
    const target = getCandidatePanelObjectiveTarget(agent.agentId, input)!
    const original = panels.projectOutOfCombatPanel({ ...input, discs })
    const exact = vi
      .spyOn(panels, 'projectOutOfCombatPanel')
      .mockReturnValue({ ...original, values: { ...original.values, atk: 2476.1 } })
    const menu = vi
      .spyOn(panels, 'projectOutOfCombatMenuPanel')
      .mockReturnValue({ ...original, values: { ...original.values, atk: 2477 } })
    try {
      expect(projectCandidatePanelObjective(target, input, discs)).toMatchObject({
        priorityStat: 'source',
        attackDeficit: expect.any(Number),
      })
      expect(projectCandidatePanelObjective(target, input, discs)!.attackDeficit).toBeGreaterThan(0)
      expect(
        prepareCandidatePanelObjective(agent.agentId, discs, input).objectiveTarget,
      ).toMatchObject({ requiresPreciseInitialStats: true })
      expect(menu).not.toHaveBeenCalled()
    } finally {
      exact.mockRestore()
      menu.mockRestore()
    }
  })
  it('keeps Lucy guide observations while using precise effective-skill preparation across consumers', () => {
    for (const [specialLevel, expected] of [
      [8, 2721.6494845360826],
      [10, 2476.190476190476],
      [16, 1922.4806201550387],
    ]) {
      const target = getCurrentBuildTargetPanel('agent-lucy', { specialLevel, coreLevel: 1 })!
      expect(targetPanelLowerBound(target, '攻击力')).toBeCloseTo(expected, 8)
      expect(target.value).toHaveProperty(
        'guideObservation.sourceVariants',
        expect.arrayContaining(['ATK 2475 at Special Lv10']),
      )
      expect(
        getCandidatePanelPolicyForContext('agent-lucy', { specialLevel, coreLevel: 1 })
          ?.minimumAttack,
      ).toBeCloseTo(expected, 8)
      expect(target.conditions.join()).toContain('不依赖核心技等级')
    }
    expect(
      targetPanelPresentation(
        getCurrentBuildTargetPanel('agent-lucy', { specialLevel: 10 }),
        '攻击力',
      ).value,
    ).toBe('≈2476.19')
    expect(
      reviewedContextualMechanicTargets({ agentId: 'agent-lucy', specialLevel: 17 }),
    ).toBeNull()
  })
  it('derives all Soukaku core levels without a teammate or duplicated mindscape skill adjustment', () => {
    for (const [index, expected] of [
      5000, 4000, 3333.3333333333335, 2941.176470588235, 2777.777777777778, 2631.5789473684213,
      2500,
    ].entries()) {
      const context = { coreLevel: index + 1 }
      const target = getCurrentBuildTargetPanel('agent-soukaku', context)!
      expect(targetPanelLowerBound(target, '攻击力')).toBeCloseTo(expected, 8)
      expect(
        getCandidatePanelPolicyForContext('agent-soukaku', context)?.minimumAttack,
      ).toBeCloseTo(expected, 8)
      expect(target.conditions.join()).toContain('不要求同冰属性或同阵营')
    }
  })
  it('separates Roxy initial preparation from signature combat crit and actual recipient windows', () => {
    const cap = reviewedContextualMechanicTargets({
      agentId: 'agent-roxy',
      coreLevel: 7,
      engineId: 'wengine-14162',
      engineRefinement: 1,
    })!
    expect(cap.values).toMatchObject({ energyRegen: 3.12, critRate: 76 })
    expect(
      reviewedContextualMechanicTargets({ agentId: 'agent-roxy', coreLevel: 1 })?.values,
    ).toMatchObject({ energyRegen: 2.2, critRate: 55 })
    expect(
      reviewedContextualMechanicTargets({
        agentId: 'agent-roxy',
        coreLevel: 7,
        engineId: 'wengine-14162',
        engineRefinement: 5,
      })?.values.critRate,
    ).toBe(68)
    expect(cap.conditions.join()).toContain('仅给锋御接受者')
    expect(cap.conditions.join()).toContain('2.88+')
    const panel = getCurrentBuildTargetPanel('agent-roxy', {
      coreLevel: 7,
      engineId: 'wengine-14162',
      engineRefinement: 1,
    })!
    expect(targetPanelLowerBound(panel, '能量自动回复')).toBeNull()
    expect(panel.value).toHaveProperty('guideObservation.energyRegen.min', 2.88)
    expect(targetPanelLowerBound(panel, '暴击率')).toBe(76)
  })
  it('preserves Claret as an explained cultivation reference and never makes 200 an initial target', () => {
    const target = getCurrentBuildTargetPanel('agent-claret', {
      coreLevel: 7,
      engineId: 'wengine-13021',
    })!
    expect(target.value).toHaveProperty('cultivationReference.keys', ['def'])
    expect(target.value).toHaveProperty('def.min', 2300)
    expect(targetPanelLowerBound(target, '防御力')).toBeNull()
    expect(target.conditions.join()).toContain('不作为当前初始暴击目标')
    expect(target.value).not.toHaveProperty('critRate')
  })
})
