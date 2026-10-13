import { describe, expect, it } from 'vitest'
import {
  projectBangbooUtility,
  parseBangbooParameterToken,
} from './currentBangbooUtilityProjection'
import { resolveBangbooBaseUtilityOutputs } from './currentBangbooBaseUtilityContracts'
import { getCurrentBangbooNumericData } from '../gameDataPacks/currentBangbooNumericCatalog'

const victoriaTrio = ['agent-lycaon', 'agent-corin', 'agent-rina'] as const
const supportTrio = ['agent-nicole', 'agent-soukaku', 'agent-lucia'] as const
const mixedTrioWithRupture = ['agent-yixuan', 'agent-dialyn', 'agent-lucia'] as const

describe('currentBangbooUtilityProjection source-backed projections', () => {
  it('keeps known base utility when additional activation is unknown, without claiming its bonus', () => {
    const result = projectBangbooUtility({
      memberIds: supportTrio,
      bangbooId: 'bangboo-butler',
      stars: 1,
      activationStatus: 'unknown',
    })
    expect(result.baseUtilities[0]?.value).toBe(9.6)
    expect(result.recommendationReason).toContain('条件待核实')
    expect(result.recommendationReason).not.toContain('合计回复11.52')
    expect(result.recipientFit).toBe('unknown')
  })

  it('compares the full source accumulation coefficient, not just its extra percentage', () => {
    const id = 'bangboo-plugboo'
    const data = getCurrentBangbooNumericData(id)!
    const additional =
      Number(
        data.skills
          .find((skill) => skill.role === 'additional_ability')!
          .levelParams[0]!.split('|')[0]!
          .replace('%', ''),
      ) / 100
    const expected = data.skills
      .filter((skill) => skill.role !== 'additional_ability')
      .reduce(
        (sum, skill) =>
          sum +
          skill.paramRefs.reduce(
            (subtotal, ref) =>
              subtotal +
              data.skillProps.find((item) => item.skillId === ref)!.elementAccumulationValue /
                10000,
            0,
          ) *
            (skill.role === 'chain' ? 1 + additional : 1),
        0,
      )
    const result = projectBangbooUtility({
      memberIds: ['agent-anby', 'agent-anton', 'agent-nicole'],
      bangbooId: id,
      stars: 1,
      activationStatus: 'active',
    })
    expect(result.comparableSlice?.key.unit).toBe('source_anomaly_buildup_coefficient')
    expect(result.comparableSlice?.key.receiver).toBe('attribute:electric')
    expect(result.comparableSlice?.value).toBeCloseTo(expected)
    expect(result.comparableSlice?.value).not.toBe(additional)
  })

  it('retains cooldown and receiver context and secondary support purposes', () => {
    const result = projectBangbooUtility({
      memberIds: supportTrio,
      bangbooId: 'bangboo-knightboo',
      stars: 5,
      activationStatus: 'active',
    })
    expect(result.comparableSlice?.key.cooldownSeconds).toBe(24)
    expect(result.comparableSlice?.key.receiver).toBe('pickup_agent')
    expect(result.secondaryPurposes).toContain('attack_buff')
  })
  it('parses formulas and tokens without hardcoding or fabricating defaults', () => {
    expect(parseBangbooParameterToken('[20 + Bangboo Level × 1.2]', 60)).toBe(92)
    expect(parseBangbooParameterToken('20%')).toBe(0.2)
    expect(parseBangbooParameterToken('0.04/s')).toBe(0.04)
    expect(parseBangbooParameterToken('3 times')).toBe(3)
    expect(parseBangbooParameterToken('invalid token')).toBeNull()
  })

  it('verifies exact source values: Booressure (气压布) is 6.4 base energy, not 3.0', () => {
    const base = resolveBangbooBaseUtilityOutputs({
      stableId: 'bangboo-booressure',
      skillLevel: 10,
      bangbooLevel: 60,
    })[0]!
    expect(base.value).toBe(6.4)
    expect(base.unit).toBe('energy_point')
    expect(base.receiver).toBe('pickup_agent')

    const projActive = projectBangbooUtility({
      memberIds: supportTrio,
      bangbooId: 'bangboo-booressure',
      stars: 1,
      activationStatus: 'active',
    })
    // Pickup agent still receives 6.4 base energy points
    expect(projActive.comparableSlice?.value).toBe(6.4)
    expect(projActive.recommendationReason).toContain('接收6.4点普通能量')
    // Additional ability is off-field: +60% at 1-star
    expect(projActive.recommendationReason).toContain(
      '为处于后场的代理人额外回复本次接触回复量的60%普通能量',
    )
    expect(projActive.recommendationReason).toContain('前场拾取者不叠加该倍率')
    expect(projActive.recommendationReason).not.toContain('不得假设')
    expect(projActive.recommendationReason).not.toContain('伪平均')
  })

  it('verifies exact source values: Knightboo (骑士布) summons 3 stars at 2.0 per star', () => {
    const base = resolveBangbooBaseUtilityOutputs({
      stableId: 'bangboo-knightboo',
      skillLevel: 10,
      bangbooLevel: 60,
    })[0]!
    expect(base.value).toBe(2.0)
    expect(base.summonCount).toBe(3)
    expect(base.unit).toBe('energy_point')

    const proj = projectBangbooUtility({
      memberIds: supportTrio,
      bangbooId: 'bangboo-knightboo',
      stars: 1,
      activationStatus: 'active',
    })
    expect(proj.comparableSlice?.value).toBe(2.0)
    expect(proj.comparableSlice?.key.deliveryModel).toBe('pickup_summon_3')
    expect(proj.recommendationReason).toContain('每枚回复2点普通能量（共3枚）')
    expect(proj.recommendationReason).toContain('提供92点攻击增益')
  })

  it('counter-example: Butler (巴特勒) multiplicative energy scaling with Victoria Housekeeping', () => {
    const base = resolveBangbooBaseUtilityOutputs({
      stableId: 'bangboo-butler',
      skillLevel: 10,
      bangbooLevel: 60,
    })[0]!
    expect(base.value).toBe(9.6)

    // Inactive (e.g. with Support trio without 2 Victoria members)
    const projInactive = projectBangbooUtility({
      memberIds: supportTrio,
      bangbooId: 'bangboo-butler',
      stars: 1,
      activationStatus: 'inactive',
    })
    expect(projInactive.comparableSlice?.value).toBe(9.6)
    expect(projInactive.recommendationReason).toContain('接收9.6点普通能量')
    expect(projInactive.recommendationReason).toContain('本队未激活额外能力')

    // Active 1-star (+20%): 9.6 * 1.2 = 11.52
    const proj1 = projectBangbooUtility({
      memberIds: victoriaTrio,
      bangbooId: 'bangboo-butler',
      stars: 1,
      activationStatus: 'active',
    })
    expect(proj1.comparableSlice?.value).toBe(11.52)
    expect(proj1.recommendationReason).toContain('接收9.6点普通能量')
    expect(proj1.recommendationReason).toContain('额外提升20%能量回复（合计回复11.52点普通能量）')

    // Active 5-star (+40%): 9.6 * 1.4 = 13.44
    const proj5 = projectBangbooUtility({
      memberIds: victoriaTrio,
      bangbooId: 'bangboo-butler',
      stars: 5,
      activationStatus: 'active',
    })
    expect(proj5.comparableSlice?.value).toBe(13.44)
    expect(proj5.recommendationReason).toContain('额外提升40%能量回复（合计回复13.44点普通能量）')
  })

  it('counter-example: Exploreboo (寻宝布) 3 random branches with unstated probabilities', () => {
    const projActive = projectBangbooUtility({
      memberIds: supportTrio,
      bangbooId: 'bangboo-exploreboo',
      stars: 1,
      activationStatus: 'active',
    })
    // 10% * 1.2 = 12% heal, 11.5% * 1.2 = 13.8% shield, 0.4 + 0.04 = 0.44/s regen
    expect(projActive.recommendationReason).toContain('回复12%邦布生命上限')
    expect(projActive.recommendationReason).toContain('提供13.8%邦布生命上限护盾')
    expect(projActive.recommendationReason).toContain('普通能量自动回复提高0.44点/秒')
    expect(projActive.recommendationReason).toContain('各分支概率未公布')
    expect(projActive.recommendationReason).not.toContain('不得假设')
    expect(projActive.recommendationReason).not.toContain('伪平均')
  })

  it('counter-example: Avocaboo (果核布) unresolved HP basis and trigger count scaling', () => {
    const projActive = projectBangbooUtility({
      memberIds: supportTrio,
      bangbooId: 'bangboo-avocaboo',
      stars: 1,
      activationStatus: 'active',
    })
    // 15% * 1.2 = 18% ratio, 15 + 3 = 18 triggers
    expect(projActive.recommendationReason).toContain('技能倍率18%')
    expect(projActive.recommendationReason).toContain('生命值基准待核实')
    expect(projActive.recommendationReason).toContain('每场战斗最多触发18次')
  })

  it('counter-example: Miss Esme (艾丝弥小姐) branch-specific bonuses with dynamic probabilities', () => {
    const spookTrio = ['agent-lucia', 'agent-nicole', 'agent-anby'] as const
    const projActive = projectBangbooUtility({
      memberIds: spookTrio,
      bangbooId: 'bangboo-miss-esme',
      stars: 3, // star 3 activates at 1 Spook Shack member
      activationStatus: 'active',
    })
    // Base: bubble 8% * 1.3 = 10.4%, star 3.9 * 1.3 = 5.07
    expect(projActive.recommendationReason).toContain('技能倍率10.4%')
    expect(projActive.recommendationReason).toContain('生命值基准待核实')
    expect(projActive.recommendationReason).toContain('5.07点普通能量')
    expect(projActive.recommendationReason).toContain('星莹与幻泡生成概率随前场生命值动态变化')
  })

  it('counter-example: Rupture member cannot receive normal energy', () => {
    const proj = projectBangbooUtility({
      memberIds: mixedTrioWithRupture,
      bangbooId: 'bangboo-butler',
      stars: 1,
      activationStatus: 'inactive',
    })
    expect(proj.recommendationReason).toContain('琉音、卢西娅')
    expect(proj.recommendationReason).not.toContain('仪玄')
    expect(proj.recommendationReason).toContain('不能补充命破成员的闪能')

    // Rupture-only team
    const allRupture = ['agent-yixuan', 'agent-yixuan', 'agent-yixuan'] // invalid trio handled gracefully
    const projInvalid = projectBangbooUtility({
      memberIds: allRupture,
      bangbooId: 'bangboo-butler',
      stars: 1,
      activationStatus: 'inactive',
    })
    expect(projInvalid.recipientFit).toBe('unknown')
  })
})
