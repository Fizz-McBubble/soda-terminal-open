import type { RosterAgent } from '../assault/types'

export type SkillKey = keyof RosterAgent['skillLevels']
export type SkillInvestmentBand = 'max_priority' | 'high_value' | 'situational' | 'baseline'

const combatSkillCap = 12
const coreSkillCap = 7

const targetFor = (skill: SkillKey, band: SkillInvestmentBand) => {
  if (skill === 'core') {
    if (band === 'max_priority') return coreSkillCap
    if (band === 'high_value') return 5
    if (band === 'situational') return 3
    return 1
  }
  if (band === 'max_priority') return combatSkillCap
  if (band === 'high_value') return 9
  if (band === 'situational') return 6
  return 1
}

export function fieldTimeIndependentSkillInvestment(input: {
  skill: SkillKey
  priorityIndex: number | null
  explicitPrimary: boolean
  explicitSupplemental: boolean
  hasScalableMechanic: boolean
}) {
  // An omitted skill is not evidence that it is unused or should stay at level 1.
  if (input.priorityIndex === null && !input.explicitPrimary && !input.explicitSupplemental) {
    return {
      band: 'unrated',
      targetLevel: null,
      label: '待确认',
      evidence: '来源未提供该技能的升级优先级或等级目标，不生成默认等级。',
    } as const
  }
  const band: SkillInvestmentBand = input.explicitPrimary
    ? 'max_priority'
    : input.explicitSupplemental
      ? 'high_value'
      : input.priorityIndex === 0 || input.priorityIndex === 1
        ? 'max_priority'
        : input.priorityIndex === 2 || input.priorityIndex === 3
          ? 'high_value'
          : input.priorityIndex === 4
            ? 'situational'
            : 'baseline'
  const targetLevel = targetFor(input.skill, band)
  return {
    band,
    targetLevel,
    label:
      band === 'max_priority'
        ? `优先升至 ${targetLevel}`
        : band === 'high_value'
          ? `建议升至 ${targetLevel}`
          : band === 'situational'
            ? `按需升至 ${targetLevel}`
            : `可保持 ${targetLevel}`,
    evidence: input.hasScalableMechanic
      ? '来源优先级与技能倍率/失衡成长共同支持；等级是 Soda 养成预算档位，不是来源原文或精确 DPS 最优解。'
      : '仅按来源优先级形成养成预算档位；缺少可复算成长时不宣称伤害收益。',
  } as const
}

export const skillInvestmentPolicy = Object.freeze({
  contract: 'soda-skill-investment-policy/v1',
  combatSkillCap,
  coreSkillCap,
  bands: Object.freeze({
    max_priority: '核心输出/机制，投入到当前非影画基础上限',
    high_value: '主要收益技能，先达到实用高等级',
    situational: '会进入部分循环，资源富余时补足',
    baseline: '当前循环不依赖，保留基础等级',
  }),
  boundary:
    '排序由来源化玩法/轮转决定；技能事件模型只验证该技能存在可成长的伤害、失衡或机制收益。没有完整固定循环时，不使用倍率总和单独推导精确 DPS 排名。',
})
