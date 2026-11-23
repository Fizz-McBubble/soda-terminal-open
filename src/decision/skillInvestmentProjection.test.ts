import { describe, expect, it } from 'vitest'
import {
  projectSkillInvestmentNextLevels,
  projectSkillNextLevelDisplay,
  resolveSkillInvestmentMindscapeBonus,
} from './skillInvestmentProjection'
import { evaluateSkillInvestmentNextLevel } from '../calculation/skillInvestmentNextLevel'

describe('skillInvestmentProjection unit tests', () => {
  it.each([
    {
      currentLevel: null,
      targetLevel: 12,
      reasonCode: 'current_level_unknown',
      title: '当前等级未记录',
    },
    {
      currentLevel: 7,
      targetLevel: null,
      reasonCode: 'target_level_unknown',
      title: '投入目标待确认',
    },
    {
      currentLevel: null,
      targetLevel: null,
      reasonCode: 'current_and_target_unknown',
      title: '等级与目标待确认',
    },
  ])('keeps known inputs and gives a cause-specific next step: $reasonCode', (missing) => {
    const result = projectSkillNextLevelDisplay(
      evaluateSkillInvestmentNextLevel({
        agentId: 'agent-ye-shunguang',
        skill: 'basic',
        effectiveLevelBonus: 0,
        ...missing,
      }),
    )
    expect(result).toMatchObject({
      status: 'unknown',
      reasonCode: missing.reasonCode,
      title: missing.title,
      fromLevel: missing.currentLevel,
      toLevel: null,
      fromBaseLevel: null,
      toBaseLevel: null,
      materialsText: '',
    })
    expect(result.nextAction).toBeTruthy()
    expect(result.tooltip).not.toContain('当前等级或来源目标未知')
    expect(result.tooltip).not.toContain('undefined')
    if (missing.currentLevel !== null) {
      expect(result.tooltip).toContain('当前技能 Lv.7')
      expect(result.tooltip).not.toContain('当前技能等级未记录')
    }
  })

  it('distinguishes an unknown mindscape offset from a missing current level', () => {
    const result = projectSkillNextLevelDisplay(
      evaluateSkillInvestmentNextLevel({
        agentId: 'agent-ye-shunguang',
        skill: 'basic',
        currentLevel: 15,
        targetLevel: 16,
        effectiveLevelBonus: null,
      }),
    )
    expect(result).toMatchObject({
      status: 'unknown',
      reasonCode: 'mindscape_bonus_unknown',
      fromLevel: 15,
      toLevel: null,
      materialsText: '',
    })
    expect(result.tooltip).toContain('影画技能加成未确认')
    expect(result.tooltip).not.toContain('当前技能等级未记录')
  })

  it('retains all missing causes when target and mindscape are both unconfirmed', () => {
    const result = projectSkillNextLevelDisplay(
      evaluateSkillInvestmentNextLevel({
        agentId: 'agent-ye-shunguang',
        skill: 'basic',
        currentLevel: 7,
        targetLevel: null,
        effectiveLevelBonus: null,
      }),
    )
    expect(result).toMatchObject({
      status: 'unknown',
      fromLevel: 7,
      toLevel: null,
      missingInputs: ['target_level', 'mindscape_bonus'],
      materialsText: '',
    })
    expect(result.tooltip).toContain('实际投入目标待确认')
    expect(result.tooltip).toContain('影画技能加成也未确认')
    expect(result.tooltip).not.toContain('当前技能等级未记录')
  })

  it('correctly maps mindscape rank to skill level bonus', () => {
    expect(resolveSkillInvestmentMindscapeBonus(null)).toBeNull()
    expect(resolveSkillInvestmentMindscapeBonus(-1)).toBeNull()
    expect(resolveSkillInvestmentMindscapeBonus(7)).toBeNull()
    expect(resolveSkillInvestmentMindscapeBonus(0)).toBe(0)
    expect(resolveSkillInvestmentMindscapeBonus(1)).toBe(0)
    expect(resolveSkillInvestmentMindscapeBonus(2)).toBe(0)
    expect(resolveSkillInvestmentMindscapeBonus(3)).toBe(2)
    expect(resolveSkillInvestmentMindscapeBonus(4)).toBe(2)
    expect(resolveSkillInvestmentMindscapeBonus(5)).toBe(4)
    expect(resolveSkillInvestmentMindscapeBonus(6)).toBe(4)
  })

  it('projects concise serializable display for combat skill next level', () => {
    // Billy basic 11 -> 12, bonus 0 (effective 11 -> 12)
    const evidence = evaluateSkillInvestmentNextLevel({
      agentId: 'agent-billy',
      skill: 'basic',
      currentLevel: 11,
      targetLevel: 12,
      effectiveLevelBonus: 0,
    })
    expect(evidence.status).toBe('supported')
    const display = projectSkillNextLevelDisplay(evidence)
    expect(display.status).toBe('supported')
    expect(display.title).toBe('Lv.11 → Lv.12')
    expect(display.fromLevel).toBe(11)
    expect(display.toLevel).toBe(12)
    expect(display.fromBaseLevel).toBe(11)
    expect(display.toBaseLevel).toBe(12)
    expect(display.gainText).toContain('伤害')
    expect(display.materialsText).toContain('丁尼')
    expect(display.materialsText).toContain('高级芯片')
    expect(display.materialsText).toContain('仓鼠笼访问器')
    expect(display.tooltip).toContain('下一级 Lv.11 → Lv.12')
    expect(display.tooltip).toContain('消耗：')
  })

  it('projects concise display for core skill next level with static growth', () => {
    // Nicole core 6 -> 7
    const evidence = evaluateSkillInvestmentNextLevel({
      agentId: 'agent-nicole',
      skill: 'core',
      currentLevel: 6,
      targetLevel: 7,
      effectiveLevelBonus: 0,
    })
    expect(evidence.status).toBe('partial')
    const display = projectSkillNextLevelDisplay(evidence)
    expect(display.status).toBe('partial')
    expect(display.title).toBe('Lv.6 → Lv.7')
    expect(display.gainText).toContain('静态成长')
    expect(display.gainText).toBe('攻击力 +25（静态成长）')
    expect(display.materialsText).toContain('丁尼')
    expect(display.materialsText).toContain('高维材料')
    expect(display.materialsText).toContain('周本材料')
  })

  it('preserves percentage points and flat energy regeneration in core growth', () => {
    const display = (agentId: string) =>
      projectSkillNextLevelDisplay(
        evaluateSkillInvestmentNextLevel({
          agentId,
          skill: 'core',
          currentLevel: 5,
          targetLevel: 7,
          effectiveLevelBonus: 0,
        }),
      )
    expect(display('agent-billy').gainText).toBe('暴击率 +4.8%（静态成长）')
    expect(display('agent-nicole').gainText).toBe('能量自动回复 +0.12（静态成长）')
  })

  it('handles reached target and cap without fake zero gains', () => {
    const reachedEvidence = evaluateSkillInvestmentNextLevel({
      agentId: 'agent-billy',
      skill: 'basic',
      currentLevel: 12,
      targetLevel: 12,
      effectiveLevelBonus: 0,
    })
    const reachedDisplay = projectSkillNextLevelDisplay(reachedEvidence)
    expect(reachedDisplay.status).toBe('no_upgrade')
    expect(reachedDisplay.title).toBe('已达标')
    expect(reachedDisplay.materialsText).toBe('')
    expect(reachedDisplay.gainText).toBe('当前等级已达到推荐目标或技能上限。')
  })

  it('preserves rows and binds nextLevel display in projectSkillInvestmentNextLevels', () => {
    const rows = [
      { key: 'basic' as const, label: '普攻', targetLevel: 12 },
      { key: 'core' as const, label: '核心技', targetLevel: 7 },
    ]
    const skillLevels = {
      basic: 11,
      dodge: 7,
      assist: 7,
      special: 7,
      chain: 7,
      core: 6,
    }
    const result = projectSkillInvestmentNextLevels({
      agentId: 'agent-billy',
      skillLevels,
      mindscape: 0,
      rows,
    })
    expect(result).toHaveLength(2)
    expect(result[0]!.key).toBe('basic')
    expect(result[0]!.nextLevel.status).toBe('supported')
    expect(result[0]!.nextLevel.title).toBe('Lv.11 → Lv.12')
    expect(result[1]!.key).toBe('core')
    expect(result[1]!.nextLevel.status).toBe('partial')
    expect(result[1]!.nextLevel.title).toBe('Lv.6 → Lv.7')
  })
})
